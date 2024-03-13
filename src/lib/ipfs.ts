import type { Logger } from 'pino'
import { injectable, singleton } from 'tsyringe'
import { z } from 'zod'

import { logger } from './logger.js'
import { serviceState } from './service-watcher/statusPoll.js'
import type { MetadataFile } from './payload.js'
import { HttpResponse } from './error-handler/index.js'
import { Env } from '../env.js'

interface FilestoreResponse {
  Name: string
  Hash: string
  Size: string
}

const dirListValidator = z.object({
  Objects: z.array(
    z.object({
      Hash: z.string(),
      Links: z.array(
        z.object({
          Hash: z.string(),
          Name: z.string(),
          Size: z.number(),
          Target: z.string(),
          Type: z.number(),
        })
      ),
    })
  ),
})

const versionValidator = z.object({
  Commit: z.string(),
  Golang: z.string(),
  Repo: z.string(),
  System: z.string(),
  Version: z.string(),
})

const peersValidator = z.object({
  Peers: z.array(
    z.object({
      Addr: z.string(),
      Direction: z.number(),
      Identify: z.object({
        Addresses: z.array(z.string()),
        AgentVersion: z.string(),
        ID: z.string(),
        Protocols: z.array(z.string()),
        PublicKey: z.string(),
      }),
      Latency: z.string(),
      Muxer: z.string(),
      Peer: z.string(),
      Streams: z.array(
        z.object({
          Protocol: z.string(),
        })
      ),
    })
  ),
})

@singleton()
@injectable()
export default class Ipfs {
  private addUrl: string
  private dirUrl: (dirHash: string) => string
  private fileUrl: (fileHash: string) => string
  private logger: Logger
  private versionURL: string
  private peersURL: string

  constructor(private env: Env) {
    this.addUrl = `http://${this.env.get('IPFS_HOST')}:${this.env.get(
      'IPFS_PORT'
    )}/api/v0/add?cid-version=0&wrap-with-directory=true`
    this.dirUrl = (dirHash) =>
      `http://${this.env.get('IPFS_HOST')}:${this.env.get('IPFS_PORT')}/api/v0/ls?arg=${dirHash}`
    this.fileUrl = (fileHash) =>
      `http://${this.env.get('IPFS_HOST')}:${this.env.get('IPFS_PORT')}/api/v0/cat?arg=${fileHash}`
    this.logger = logger.child({ module: 'ipfs' })
    this.versionURL = `http://${this.env.get('IPFS_HOST')}:${this.env.get('IPFS_PORT')}/api/v0/version`
    this.peersURL = `http://${this.env.get('IPFS_HOST')}:${this.env.get('IPFS_PORT')}/api/v0/swarm/peers`
  }

  async addFile({ blob, filename }: MetadataFile): Promise<string> {
    this.logger.debug('Uploading file %s', filename)
    const form = new FormData()
    form.append('file', blob, filename)
    const res = await fetch(this.addUrl, {
      method: 'POST',
      body: form,
    })

    const text = await res.text()

    if (!res.ok) {
      throw new HttpResponse({ code: 500, message: text })
    }

    // Build string of objects into array
    const json = text
      .split('\n')
      .filter((obj) => obj.length > 0)
      .map((obj) => JSON.parse(obj))

    const hash = findHash(json)
    this.logger.debug('Upload of file %s succeeded. Hash is %s', filename, hash)
    return hash
  }

  async getFile(hash: string): Promise<MetadataFile> {
    const dirUrl = this.dirUrl(hash)
    const dirRes = await fetch(dirUrl, { method: 'POST' })
    if (!dirRes.ok || !dirRes.body) {
      throw new Error(`Error fetching directory from IPFS (${dirRes.status}): ${await dirRes.text()}`)
    }

    // Parse stream of dir data to get the file hash
    const data = dirListValidator.parse(await dirRes.json())
    const link = data?.Objects?.[0]?.Links?.[0]

    if (!link) {
      throw new Error(`Error parsing directory from IPFS (${dirRes.status}): ${await dirRes.text()}`)
    }
    const fileHash = link.Hash
    const filename = link.Name

    // Return file
    const fileUrl = this.fileUrl(fileHash)
    const fileRes = await fetch(fileUrl, { method: 'POST' })
    if (!fileRes.ok) throw new Error(`Error fetching file from IPFS (${fileRes.status}): ${await fileRes.text()}`)

    return { blob: await fileRes.blob(), filename }
  }

  getStatus = async () => {
    try {
      const results = await Promise.all([
        fetch(this.versionURL, { method: 'POST' }),
        fetch(this.peersURL, { method: 'POST' }),
      ])
      if (results.some((result) => !result.ok)) {
        return {
          status: serviceState.DOWN,
          detail: {
            message: 'Error getting status from IPFS node',
          },
        }
      }

      const [versionResultJson, peersResultJson] = await Promise.all(results.map((r) => r.json()))
      const [versionResult, peersResult] = [
        versionValidator.parse(versionResultJson),
        peersValidator.parse(peersResultJson),
      ]
      const peers: { Peer: unknown }[] = peersResult.Peers || []
      const peerCount = new Set(peers.map((peer) => peer.Peer)).size
      return {
        status: serviceState.UP,
        detail: {
          version: versionResult.Version,
          peerCount: peerCount,
        },
      }
    } catch (err) {
      return {
        status: serviceState.DOWN,
        detail: {
          message: 'Error getting status from IPFS node',
        },
      }
    }
  }
}

const findHash = (filestoreResponse: FilestoreResponse[]) => {
  // directory has no Name
  const dir = filestoreResponse.find((r) => r.Name === '')
  if (dir && dir.Hash && dir.Size) {
    return dir.Hash
  } else {
    throw new HttpResponse({ code: 500, message: 'ipfs failed to make directory' })
  }
}
