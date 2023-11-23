import { ApiPromise, WsProvider, Keyring, SubmittableResult } from '@polkadot/api'
import { blake2AsHex } from '@polkadot/util-crypto'
import { SubmittableExtrinsic } from '@polkadot/api/types'
import type { u128 } from '@polkadot/types'
import { serviceState } from './service-watcher/statusPoll'
import { Logger } from 'pino'
import { TransactionState } from '../models/transaction'

import type { Payload, Output, Metadata } from './payload'
import { HEX } from '../models/strings'
import { hexToBs58 } from '../utils/controller-helpers'

const processRanTopic = blake2AsHex('utxoNFT.ProcessRan')

export interface NodeCtorConfig {
  host: string
  port: number
  logger: Logger
  userUri: string
}

export interface ProcessRanEvent {
  callHash: HEX
  blockHash: HEX
  sender: string
  process: {
    id: string
    version: number
  }
  inputs: number[]
  outputs: number[]
}

interface RoleEnum {
  name: string | undefined
  index: number | undefined
}

interface SubstrateToken {
  id: number
  metadata: {
    [key in string]: { literal: string } | { file: string } | { tokenId: number } | { None: null }
  }
  roles: {
    [key in 'Owner' | 'MemberA' | 'MemberB' | 'Optimiser']: string
  }
}

type EventData =
  | {
      outputs: u128[]
    }
  | undefined

export default class ChainNode {
  private provider: WsProvider
  private api: ApiPromise
  private keyring: Keyring
  private logger: Logger
  private userUri: string
  private roles: RoleEnum[]

  constructor({ host, port, logger, userUri }: NodeCtorConfig) {
    this.logger = logger.child({ module: 'ChainNode' })
    this.provider = new WsProvider(`ws://${host}:${port}`)
    this.userUri = userUri
    this.api = new ApiPromise({ provider: this.provider })
    this.keyring = new Keyring({ type: 'sr25519' })
    this.roles = []

    this.api.isReadyOrError.catch(() => {
      // prevent unhandled promise rejection errors
    })

    this.api.on('disconnected', () => {
      this.logger.warn(`Disconnected from substrate node at ${host}:${port}`)
    })

    this.api.on('connected', () => {
      this.logger.info(`Connected to substrate node at ${host}:${port}`)
    })

    this.api.on('error', (err) => {
      this.logger.error(`Error from substrate node connection. Error was ${err.message || JSON.stringify(err)}`)
    })
  }

  getStatus = async () => {
    await this.api.isReady
    if (!this.api.isConnected) {
      return {
        status: serviceState.DOWN,
        detail: {
          message: 'Cannot connect to substrate node',
        },
      }
    }
    const [chain, runtime] = await Promise.all([this.api.runtimeChain, this.api.runtimeVersion])
    return {
      status: serviceState.UP,
      detail: {
        chain,
        runtime: {
          name: runtime.specName,
          versions: {
            spec: runtime.specVersion.toNumber(),
            impl: runtime.implVersion.toNumber(),
            authoring: runtime.authoringVersion.toNumber(),
            transaction: runtime.transactionVersion.toNumber(),
          },
        },
      },
    }
  }

  async getLastFinalisedBlockHash(): Promise<HEX> {
    await this.api.isReady
    const result = await this.api.rpc.chain.getFinalizedHead()
    return result.toHex()
  }

  async getHeader(hash: HEX): Promise<{ hash: HEX; height: number; parent: HEX }> {
    await this.api.isReady
    const result = await this.api.rpc.chain.getHeader(hash)
    return {
      hash,
      height: result.number.toNumber(),
      parent: result.parentHash.toHex(),
    }
  }

  async getRoles(): Promise<RoleEnum[]> {
    await this.api.isReady

    const registry = this.api.registry
    const lookup = registry.lookup
    const lookupId = registry.getDefinition('DscpNodeRuntimeRole') as `Lookup${number}`

    const rolesEnum = lookup.getTypeDef(lookupId).sub
    if (Array.isArray(rolesEnum)) {
      return rolesEnum.map((e) => ({ name: e.name, index: e.index }))
    } else {
      throw new Error('No roles found on-chain')
    }
  }

  roleToIndex(role: string) {
    const entry = this.roles.find((e) => e.name === role)

    if (!entry || entry.index === undefined) {
      throw new Error(`Invalid role: ${role}`)
    }

    return entry.index
  }

  async prepareRunProcess({ process, inputs, outputs }: Payload) {
    const outputsAsMaps = await Promise.all(
      outputs.map(async (output: Output) => [
        await this.processRoles(output.roles),
        this.processMetadata(output.metadata),
      ])
    )

    this.logger.debug('Preparing Transaction inputs: %j outputs: %j', inputs, outputsAsMaps)

    await this.api.isReady
    const extrinsic = this.api.tx.utxoNFT.runProcess(process, inputs, outputsAsMaps)
    const account = this.keyring.addFromUri(this.userUri)
    const signed = await extrinsic.signAsync(account, { nonce: -1 })
    return signed
  }

  async submitRunProcess(
    extrinsic: SubmittableExtrinsic<'promise', SubmittableResult>,
    update: (state: TransactionState) => Promise<Record<string, string>[]>
  ): Promise<void> {
    try {
      this.logger.debug('Submitting Transaction %j', extrinsic.hash.toHex())
      const unsub: () => void = await extrinsic.send((result: SubmittableResult): void => {
        this.logger.debug('result.status %s', JSON.stringify(result.status))

        const { dispatchError, status } = result

        if (dispatchError) {
          this.logger.warn('dispatch error %s', dispatchError)
          update('failed')
          unsub()
          if (dispatchError.isModule) {
            const decoded = this.api.registry.findMetaError(dispatchError.asModule)
            throw new Error(`Node dispatch error: ${decoded.name}`)
          }

          throw new Error(`Unknown node dispatch error: ${dispatchError}`)
        }

        if (status.isInBlock) update('inBlock')
        if (status.isFinalized) {
          const processRanEvent = result.events.find(({ event: { method } }) => method === 'ProcessRan')
          const data = processRanEvent?.event?.data as EventData
          const tokens = data?.outputs?.map((x) => x.toNumber())

          if (!tokens) {
            update('failed')
            throw new Error('No token IDs returned')
          }

          update('finalised')
          unsub()
        }
      })
    } catch (err) {
      update('failed')
      this.logger.warn(`Error in run process transaction: ${err}`)
    }
  }

  async processRoles(roles: Record<string, string>) {
    if (this.roles.length === 0) {
      this.roles = await this.getRoles()
    }

    return new Map(
      Object.entries(roles).map(([key, v]) => {
        return [this.roleToIndex(key), v]
      })
    )
  }

  processMetadata(metadata: Metadata) {
    return new Map(
      Object.entries(metadata).map(([key, value]) => {
        let processedValue
        switch (value.type) {
          case 'LITERAL':
            processedValue = { Literal: value.value as string }
            break
          case 'TOKEN_ID':
            processedValue = { TokenId: value.value as string }
            break
          case 'FILE':
            processedValue = { File: value.value as string }
            break
          default:
          case 'NONE':
            processedValue = { None: null }
            break
        }

        return [key, processedValue] as readonly [unknown, unknown]
      })
    )
  }

  async getLastTokenId() {
    await this.api.isReady
    const lastTokenId = await this.api.query.utxoNFT.lastToken()

    return lastTokenId ? parseInt(lastTokenId.toString(), 10) : 0
  }

  async watchFinalisedBlocks(onNewFinalisedHead: (blockHash: string) => Promise<void>) {
    await this.api.isReady
    await this.api.rpc.chain.subscribeFinalizedHeads((header) => onNewFinalisedHead(header.hash.toHex()))
  }

  async getProcessRanEvents(blockhash: HEX): Promise<ProcessRanEvent[]> {
    await this.api.isReady
    const apiAtBlock = await this.api.at(blockhash)
    const processRanEventIndexes = (await apiAtBlock.query.system.eventTopics(processRanTopic)) as unknown as [
      never,
      number,
    ][]
    if (processRanEventIndexes.length === 0) {
      return []
    }

    const block = await this.api.rpc.chain.getBlock(blockhash)
    const events = (await apiAtBlock.query.system.events()) as unknown as {
      event: { data: unknown[] }
      phase: { get asApplyExtrinsic(): number }
    }[]
    return processRanEventIndexes.map(([, index]) => {
      const event = events[index]
      const extrinsicIndex = event.phase.asApplyExtrinsic
      const process = event.event.data[1] as { id: string; version: { toNumber: () => number } }
      return {
        callHash: block.block.extrinsics[extrinsicIndex].hash.toString() as HEX,
        blockHash: blockhash,
        sender: (event.event.data[0] as { toString: () => string }).toString(),
        process: {
          id: Buffer.from(process.id).toString('ascii'),
          version: process.version.toNumber(),
        },
        inputs: (event.event.data[2] as { toNumber: () => number }[]).map((i) => i.toNumber()),
        outputs: (event.event.data[3] as { toNumber: () => number }[]).map((o) => o.toNumber()),
      }
    })
  }

  async getToken(tokenId: number, blockHash: HEX | null = null) {
    const api = blockHash ? await this.api.at(blockHash) : this.api
    const token = (await api.query.utxoNFT.tokensById(tokenId)).toJSON() as unknown as SubstrateToken
    const metadata = new Map(
      Object.entries(token.metadata).map(([keyHex, entry]) => {
        const key = Buffer.from(keyHex.substring(2), 'hex').toString('utf8')
        const [valueKey, valueRaw] = Object.entries(entry)[0]
        if (valueKey === 'None' || valueKey === 'tokenId') {
          return [key, valueRaw]
        }

        if (valueKey === 'file') {
          return [key, hexToBs58(valueRaw)]
        }

        const valueHex = valueRaw || '0x'
        const value = Buffer.from(valueHex.substring(2), 'hex').toString('utf8')
        return [key, value]
      })
    )
    const roles = new Map(Object.entries(token.roles).map(([role, account]) => [role.toLowerCase(), account]))

    return {
      id: token.id,
      metadata,
      roles,
    }
  }
}