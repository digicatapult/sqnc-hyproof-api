import {
  ValidateError,
  Controller,
  Post,
  Get,
  Route,
  Response,
  Body,
  SuccessResponse,
  Tags,
  Security,
  Path,
  Query,
} from 'tsoa'
import type { Logger } from 'pino'
import { injectable } from 'tsyringe'

import { logger } from '../../../lib/logger'
import Database from '../../../lib/db'
import { BadRequest, NotFound } from '../../../lib/error-handler/index'
import Identity from '../../../lib/services/identity'
import * as example from '../../../models/example'
import { DATE, UUID } from '../../../models/strings'
// import { TransactionResponse, TransactionType } from '../../../models/transaction'
import ChainNode from '../../../lib/chainNode'
import env from '../../../env'

@Route('v1/example')
@injectable()
@Tags('example')
@Security('BearerAuth')
export class Example extends Controller {
  log: Logger
  db: Database
  node: ChainNode

  constructor(private identity: Identity) {
    super()
    this.log = logger.child({ controller: '/example' })
    this.db = new Database()
    this.node = new ChainNode({
      host: env.NODE_HOST,
      port: env.NODE_PORT,
      logger,
      userUri: env.USER_URI,
    })
    this.identity = identity
  }

  /**
   * description
   * @summary
   */
  @Post()
  @Response<BadRequest>(400, 'Request was invalid')
  @Response<ValidateError>(422, 'Validation Failed')
  @SuccessResponse('201')
  public async proposeMatch2(@Body() { example = '' }: example.Request): Promise<example.Response> {
    this.log.info({ identity: this.identity, example })

    return { message: 'ok' }
  }

  /**
   * description
   * @summary Lists
   */
  @Get('/')
  public async getAll(@Query() createdAt?: DATE): Promise<example.Response | example.Response[]> {
    if (createdAt) return { message: 'by createdAt' }
    return [{ message: 'all' }]
  }

  /**
   * @summary
   * @param id The example's identifier
   */
  @Response<ValidateError>(422, 'Validation Failed')
  @Response<NotFound>(404, 'Item not found')
  @Get('{id}')
  public async getMatch2(@Path() id: UUID): Promise<example.Response> {
    if (!id) throw new BadRequest()

    return { message: 'ok', id }
  }
}
