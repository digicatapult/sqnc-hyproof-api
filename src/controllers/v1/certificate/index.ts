import {
  ValidateError,
  Controller,
  Post,
  Get,
  Route,
  Response,
  Body,
  SuccessResponse,
  Example,
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
import * as Certificate from '../../../models/certificate'
import { DATE, UUID } from '../../../models/strings'
// import { TransactionResponse, TransactionType } from '../../../models/transaction'
import ChainNode from '../../../lib/chainNode'
import env from '../../../env'
import { camelToSnakeJSObject } from '../../../lib/utils/shared'
import { processInitiateCert } from 'src/lib/payload'

@Route('v1/certificate')
@injectable()
@Tags('certificate')
@Security('BearerAuth')
export class CertificateController extends Controller {
  log: Logger
  db: Database
  node: ChainNode

  constructor(private identity: Identity) {
    super()
    this.log = logger.child({ controller: '/certificate' })
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
   * @summary insert a certificate for initialisation
   */
  @Example<Certificate.Payload>({
    id: '52907745-7672-470e-a803-a2f8feb52944',
    capacity: 10,
    co2e: 1000,
  })
  @Post()
  @Response<BadRequest>(400, 'Request was invalid')
  @Response<ValidateError>(422, 'Validation Failed')
  @SuccessResponse('201')
  public async post(@Body() body: Certificate.Request): Promise<Certificate.Response> {
    this.log.info({ identity: this.identity, body })
    const formatted = camelToSnakeJSObject(body)

    return {
      message: 'ok',
      result: await this.db.insert('certificate', formatted),
    }
  }

  /**
   *
   * @summary Lists all local certificates
   * TODO - combine where so with all possible options e.g.
   *   columns so it's not a default and will be rendered in swagger
   */

  @Get('/')
  public async getAll(@Query() createdAt?: DATE): Promise<Certificate.Response> {
    const where: Record<string, number | string | DATE> = {}
    if (createdAt) where.created_at = createdAt

    return {
      message: 'ok',
      certificates: await this.db.get('certificate', where),
    }
  }

  /**
   * @summary returns certificate by id
   * @example id "52907745-7672-470e-a803-a2f8feb52944"
   */
  @Response<ValidateError>(422, 'Validation Failed')
  @Response<NotFound>(404, '<item> not found')
  @Response<BadRequest>(400, 'ID must be supplied in UUID format')
  @Get('{id}')
  public async getById(@Path() id: UUID): Promise<Certificate.Response> {
    if (!id) throw new BadRequest()

    return {
      message: 'ok',
      certificate: await this.db.get('certificate', { id }),
    }
  }

  /**
   * @summary returns certificate transaction by certificate and transaction ids
   * @example id "52907745-7672-470e-a803-a2f8feb52944"
   */
  @Response<ValidateError>(422, 'Validation Failed')
  @Response<NotFound>(404, '<item> not found')
  @Response<BadRequest>(400, 'ID must be supplied in UUID format')
  @Get('{id}/initiation/{transactionId}')
  public async getTransaction(@Path() id: UUID, transactionId: UUID): Promise<Certificate.Response> {
    if (!id || !transactionId) throw new BadRequest()

    return {
      message: 'ok',
      certificate: await this.db.get('transaction', {
        local_id: id,
        id: transactionId,
        transaction_type: 'certificate',
      }),
    }
  }

  /**
   * @summary returns transactions by certificate local id
   * @example id "52907745-7672-470e-a803-a2f8feb52944"
   */
  @Response<ValidateError>(422, 'Validation Failed')
  @Response<NotFound>(404, '<item> not found')
  @Response<BadRequest>(400, 'ID must be supplied in UUID format')
  @Get('{id}/initiation')
  public async getTransactions(@Path() id: UUID): Promise<Certificate.Response> {
    if (!id) throw new BadRequest()

    return {
      controller: 'certificte',
      message: 'ok',
      transactions: await this.db.get('transaction', { local_id: id, transaction_type: 'certificate' }),
    }
  }

  /**
   * A member creates the demandA {demandAId} on-chain. The demandA is now viewable to other members.
   * @summary Create a new demandA on-chain
   * @param demandAId The demandA's identifier
   */
  @Post('{demandAId}/creation')
  @Response<NotFound>(404, 'Item not found')
  @SuccessResponse('201')
  public async createOnChain(@Path() id: UUID): Promise<Certificate.Response | string> {
    const [certificate] = await this.db.get('certificate', { id })
    if (certificate.state !== 'revoked') throw new BadRequest('certificate must not be revoked')

    const extrinsic = await this.node.prepareRunProcess(processInitiateCert(certificate))
    const [transaction] = await this.db.insert('certificate', {
      api_type: 'certificate',
      transaction_type: 'initialise',
      local_id: certificate.id,
      state: 'submitted',
      hash: extrinsic.hash.toHex(),
    })

    this.node.submitRunProcess(extrinsic, (state) => this.db.update('transaction', { id }, { state }))

    return transaction
  }
}
