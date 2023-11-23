import {
  Security,
  Tags,
  UploadedFile,
  Request,
  Controller,
  Get,
  Route,
  Path,
  Post,
  Response,
  SuccessResponse,
  Produces,
  ValidateError,
  Query,
} from 'tsoa'
import { Logger } from 'pino'
import express from 'express'
import { Readable } from 'node:stream'

import { logger } from '../../../lib/logger'
import Database, { AttachmentRow } from '../../../lib/db'
import type { Attachment } from '../../../models'
import { BadRequest, NotFound } from '../../../lib/error-handler'
import type { UUID, DATE } from '../../../models/strings'
import Ipfs from '../../../lib/ipfs'
import env from '../../../env'
import { parseDateParam } from '../../../lib/utils/queryParams'

const parseAccept = (acceptHeader: string) =>
  acceptHeader
    .split(',')
    .map((acceptElement) => {
      const trimmed = acceptElement.trim()
      const [mimeType, quality = '1'] = trimmed.split(';q=')
      return { mimeType, quality: parseFloat(quality) }
    })
    .sort((a, b) => {
      if (a.quality !== b.quality) {
        return b.quality - a.quality
      }
      const [aType, aSubtype] = a.mimeType.split('/')
      const [bType, bSubtype] = b.mimeType.split('/')
      if (aType === '*' && bType !== '*') {
        return 1
      }
      if (aType !== '*' && bType === '*') {
        return -1
      }
      if (aSubtype === '*' && bSubtype !== '*') {
        return 1
      }
      if (aSubtype !== '*' && bSubtype === '*') {
        return -1
      }
      return 0
    })
    .map(({ mimeType }) => mimeType)

@Route('v1/attachment')
@Tags('attachment')
@Security('BearerAuth')
export class attachment extends Controller {
  log: Logger
  db: Database = new Database()
  ipfs: Ipfs = new Ipfs({
    host: env.IPFS_HOST,
    port: env.IPFS_PORT,
    logger,
  })

  constructor() {
    super()
    this.log = logger.child({ controller: '/attachment' })
  }

  octetResponse(buffer: Buffer, name: string): Readable {
    // default to octet-stream or allow error middleware to handle
    this.setHeader('access-control-expose-headers', 'content-disposition')
    this.setHeader('content-disposition', `attachment; filename="${name}"`)
    this.setHeader('content-type', 'application/octet-stream')
    this.setHeader('maxAge', `${365 * 24 * 60 * 60 * 1000}`)
    this.setHeader('immutable', 'true')

    return Readable.from(buffer)
  }

  @Get('/')
  @SuccessResponse(200, 'returns all attachment')
  public async get(@Query() updated_since?: DATE): Promise<Attachment[]> {
    this.log.debug('retrieving all attachment')

    const attachments: AttachmentRow[] = await this.db.get(
      'attachment',
      updated_since ? { created_at: parseDateParam(updated_since) } : {}
    )
    return attachments.map(({ ipfs_hash, ...rest }): Attachment => ({ ...rest, createdAt: rest.created_at }))
  }

  @Post('/')
  @SuccessResponse(201, 'attachment has been created')
  @Response<ValidateError>(422, 'Validation Failed')
  public async create(
    @Request() req: express.Request,
    @UploadedFile() file?: Express.Multer.File
  ): Promise<Attachment> {
    this.log.debug(`creating an attachment filename: ${file?.originalname || 'json'}`)

    if (!req.body && !file) throw new BadRequest('nothing to upload')

    const filename = file ? file.originalname : 'json'
    const fileBlob = new Blob([Buffer.from(file?.buffer || JSON.stringify(req.body))])
    const ipfsHash = await this.ipfs.addFile({ blob: fileBlob, filename })

    const [{ id, created_at }] = await this.db.insert('attachment', {
      filename,
      ipfs_hash: ipfsHash,
      size: fileBlob.size,
    })

    return {
      id,
      filename,
      size: fileBlob.size,
      createdAt: created_at,
    }
  }

  @Get('/{id}')
  @Response<NotFound>(404)
  @Produces('application/json')
  @Produces('application/octet-stream')
  @SuccessResponse(200)
  public async getById(@Request() req: express.Request, @Path() id: UUID): Promise<unknown | Readable> {
    this.log.debug(`attempting to retrieve ${id} attachment`)
    const [attachment] = await this.db.get('attachment', { id })
    if (!attachment) throw new NotFound('attachment')
    const { filename, ipfs_hash, size } = attachment

    const { blob, filename: ipfsFilename } = await this.ipfs.getFile(ipfs_hash)
    const blobBuffer = Buffer.from(await blob.arrayBuffer())

    if (size === null || filename === null) {
      try {
        await this.db.update('attachment', { id }, { filename: ipfsFilename, size: blob.size })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'unknown'
        this.log.warn('Error updating attachment size: %s', message)
      }
    }

    const orderedAccept = parseAccept(req.headers.accept || '*/*')
    if (filename === 'json') {
      for (const mimeType of orderedAccept) {
        if (mimeType === 'application/json' || mimeType === 'application/*' || mimeType === '*/*') {
          try {
            const json = JSON.parse(blobBuffer.toString())
            return json
          } catch (err) {
            this.log.warn(`Unable to parse json file for attachment ${id}`)
            return this.octetResponse(blobBuffer, filename)
          }
        }
        if (mimeType === 'application/octet-stream') {
          return this.octetResponse(blobBuffer, filename)
        }
      }
    }
    return this.octetResponse(blobBuffer, filename || ipfsFilename)
  }
}