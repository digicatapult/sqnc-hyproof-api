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
import Database, { CertificateRow, Where } from '../../../lib/db'
import { BadRequest, InternalServerError, NotFound } from '../../../lib/error-handler/index'
import Identity from '../../../lib/services/identity'
import * as Certificate from '../../../models/certificate'
import { DATE, UUID } from '../../../models/strings'
import ChainNode from '../../../lib/chainNode'
import env from '../../../env'
import { processInitiateCert } from '../../../lib/payload'
import { TransactionState } from '../../../models/transaction'

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
  }

  private async mapIdentities(certs: CertificateRow[]): Promise<CertificateRow[]> {
    const memberMap = new Map<string, Promise<{ alias: string }>>()
    const getMemberPromise = (addr: string): Promise<{ alias: string }> => {
      let memberPromise = memberMap.get(addr)
      if (!memberPromise) {
        memberPromise = this.identity.getMemberByAddress(addr)
        memberMap.set(addr, memberPromise)
      }
      return memberPromise
    }

    return await Promise.all(
      certs.map(async (cert: CertificateRow) => {
        return {
          ...cert,
          energy_owner: (await getMemberPromise(cert.energy_owner)).alias,
          hydrogen_owner: (await getMemberPromise(cert.hydrogen_owner)).alias,
        }
      })
    )
  }

  /**
   * @summary insert a certificate for initialisation
   */
  @Post()
  @Response<BadRequest>(400, 'Request was invalid')
  @Response<ValidateError>(422, 'Validation Failed')
  @SuccessResponse('201')
  public async postDraft(
    @Body() { hydrogen_quantity_mwh, energy_owner }: Certificate.Payload
  ): Promise<Certificate.GetCertificateResponse> {
    this.log.trace({ identity: this.identity, energy_owner })

    const identities = {
      hydrogen_owner: await this.identity.getMemberBySelf(),
      energy_owner: await this.identity.getMemberByAlias(energy_owner),
    }

    // errors: handled by middlewar, thrown by the library e.g. this.lib.fn()
    const [certificate] = await this.db.insert('certificate', {
      hydrogen_quantity_mwh,
      hydrogen_owner: identities.hydrogen_owner.address,
      energy_owner: identities.energy_owner.address,
    })
    if (!certificate) throw new InternalServerError()

    return {
      ...certificate,
      hydrogen_owner: identities.hydrogen_owner.alias,
      energy_owner: identities.energy_owner.alias,
    }
  }

  /**
   *
   * @summary Lists all local certificates
   */
  @Get('/')
  @Response<NotFound>(404, '<item> not found')
  public async getAll(@Query() createdAt?: DATE): Promise<Certificate.ListCertificatesResponse> {
    const where: Where<'certificate'> = {}
    if (createdAt) where.created_at = new Date(createdAt)

    const found = await this.db.get('certificate', where)
    const certificates = await this.mapIdentities(found)

    return certificates
  }

  /**
   * @summary returns certificate by id
   * @example id "52907745-7672-470e-a803-a2f8feb52944"
   */
  @Response<ValidateError>(422, 'Validation Failed')
  @Response<NotFound>(404, '<item> not found')
  @Response<BadRequest>(400, 'ID must be supplied in UUID format')
  @Get('{id}')
  public async getById(@Path() id: UUID): Promise<Certificate.GetCertificateResponse> {
    if (!id) throw new BadRequest()
    let certificates = await this.db.get('certificate', { id })
    certificates = await this.mapIdentities(certificates)
    const certificate = certificates[0]
    if (!certificate) throw new NotFound(id)
    return certificate
  }

  /**
   * @summary returns certificate transaction by certificate and transaction ids
   * @example id "52907745-7672-470e-a803-a2f8feb52944"
   */
  @Response<ValidateError>(422, 'Validation Failed')
  @Response<NotFound>(404, '<item> not found')
  @Response<BadRequest>(400, 'ID must be supplied in UUID format')
  @Get('{id}/initiation/{transactionId}')
  public async getTransaction(@Path() id: UUID, transactionId: UUID): Promise<Certificate.GetTransactionResponse> {
    if (!id || !transactionId) throw new BadRequest()

    const [transaction] = await this.db.get('transaction', {
      local_id: id,
      id: transactionId,
      api_type: 'certificate',
    })
    if (!transaction) throw new NotFound(id)
    return transaction
  }

  /**
   * @summary returns transactions by certificate local id
   * @example id "52907745-7672-470e-a803-a2f8feb52944"
   */
  @Response<ValidateError>(422, 'Validation Failed')
  @Response<NotFound>(404, '<item> not found')
  @Response<BadRequest>(400, 'ID must be supplied in UUID format')
  @Get('{id}/initiation')
  public async getTransactions(@Path() id: UUID): Promise<Certificate.ListTransactionResponse> {
    if (!id) throw new BadRequest()
    return await this.db.get('transaction', { local_id: id, api_type: 'certificate' })
  }

  /**
   * A member creates the demandA {demandAId} on-chain. The demandA is now viewable to other members.
   * @summary Create a new demandA on-chain
   * @param demandAId The demandA's identifier
   */
  @Post('{id}/initiation')
  @Response<NotFound>(404, 'Item not found')
  @SuccessResponse('201')
  public async createOnChain(@Path() id: UUID): Promise<Certificate.GetTransactionResponse> {
    const [certificate]: CertificateRow[] = await this.db.get('certificate', { id })
    if (certificate.state === 'revoked') throw new BadRequest('certificate must not be revoked')

    const extrinsic = await this.node.prepareRunProcess(processInitiateCert(certificate))
    const [transaction] = await this.db.insert('transaction', {
      api_type: 'certificate',
      local_id: certificate.id,
      hash: extrinsic.hash.toHex(),
    })
    if (!transaction) throw new BadRequest()

    this.node.submitRunProcess(extrinsic, (state: TransactionState) =>
      this.db.update('transaction', transaction, { state })
    )

    return transaction
  }
}
