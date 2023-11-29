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
import Database, { CertificateRow } from '../../../lib/db'
import { BadRequest, NotFound } from '../../../lib/error-handler/index'
import Identity from '../../../lib/services/identity'
import * as Certificate from '../../../models/certificate'
import { DATE, UUID } from '../../../models/strings'
import ChainNode from '../../../lib/chainNode'
import env from '../../../env'
import { processInitiateCert } from '../../../lib/payload'
import { TransactionState } from '../../../models/transaction'

// import { TransactionResponse, TransactionType } from '../../../models/transaction'
// import { camelToSnake } from '../../../lib/utils/shared'

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
   * TODO handle multiple
   * @summary insert a certificate for initialisation
   */
  @Post()
  @Response<BadRequest>(400, 'Request was invalid')
  @Response<ValidateError>(422, 'Validation Failed')
  @SuccessResponse('201')
  public async postDraft(
    @Body() { hydrogen_quantity_mwh, energy_owner }: Certificate.Payload
  ): Promise<Certificate.Response> {
    this.log.info({ identity: this.identity, energy_owner })

    const { address: hydrogen_owner } = await this.identity.getMemberBySelf()

    // TODO - handle error if alias not found
    // const { address: energy_owner_address } = await this.identity.getMemberByAlias(energy_owner)

    return {
      message: 'ok',
      result: await this.db.insert('certificate', {
        hydrogen_quantity_mwh,
        hydrogen_owner,
        energy_owner: '5HpG9w8EBLe5XCrbczpwq5TSXvedjrBGCwqxK1iQ7qUsSWFc',
      }),
    }
  }

  /**
   *
   * @summary Lists all local certificates
   * TODO - combine [where] so with all possible options e.g.
   *   columns so it's not a default and will be rendered in swagger
   */
  @Get('/')
  @Response<NotFound>(404, '<item> not found')
  public async getAll(@Query() createdAt?: DATE): Promise<Certificate.Response> {
    const where: Record<string, number | string | DATE> = {}
    if (createdAt) where.created_at = createdAt

    return {
      message: 'ok',
      // TODO - transform hydrogen_owner and energy_owner to aliases
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
      // TODO - transform hydrogen_owner and energy_owner to aliases
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
      // TODO - transform hydrogen_owner and energy_owner to aliases
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
      // TODO - transform hydrogen_owner and energy_owner to aliases
      transactions: await this.db.get('transaction', { local_id: id, transaction_type: 'certificate' }),
    }
  }

  /**
   * A member creates the demandA {demandAId} on-chain. The demandA is now viewable to other members.
   * @summary Create a new demandA on-chain
   * @param demandAId The demandA's identifier
   */
  @Post('{id}/initiation')
  @Response<NotFound>(404, 'Item not found')
  @SuccessResponse('201')
  public async createOnChain(@Path() id: UUID): Promise<Certificate.Response> {
    const [certificate]: CertificateRow[] = await this.db.get('certificate', { id })
    if (certificate.state === 'revoke') throw new BadRequest('certificate must not be revoked')

    const extrinsic = await this.node.prepareRunProcess(processInitiateCert(certificate))
    const transaction = await this.db.insert('transaction', {
      api_type: 'certificate',
      transaction_type: 'initialise',
      local_id: certificate.id,
      hash: extrinsic.hash.toHex().slice(2),
    })

    this.node.submitRunProcess(extrinsic, (state: TransactionState) => this.db.update('transaction', { id }, { state }))

    // TODO - transform hydrogen_owner and energy_owner to aliases
    return transaction
  }
}
