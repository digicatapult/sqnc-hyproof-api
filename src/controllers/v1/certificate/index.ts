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
  Put,
} from 'tsoa'
import type { Logger } from 'pino'
import { injectable } from 'tsyringe'

import { logger } from '../../../lib/logger'
import { CertificateRow, Where } from '../../../lib/db/types'
import Database from '../../../lib/db'
import { BadRequest, InternalServerError, NotFound } from '../../../lib/error-handler/index'
import Identity from '../../../lib/services/identity'
import * as Certificate from '../../../models/certificate'
import { DATE, UUID } from '../../../models/strings'
import ChainNode from '../../../lib/chainNode'
import { processInitiateCert, processIssueCert, processRevokeCert } from '../../../lib/payload'
import { TransactionState } from '../../../models/transaction'
import Commitment from '../../../lib/services/commitment'
import EmissionsCalculator from '../../../lib/services/emissionsCalculator'

@Route('v1/certificate')
@injectable()
@Tags('certificate')
@Security('BearerAuth')
export class CertificateController extends Controller {
  log: Logger

  constructor(
    private identity: Identity,
    private db: Database,
    private node: ChainNode,
    private commitment: Commitment,
    private emissionCalculator: EmissionsCalculator
  ) {
    super()
    this.log = logger.child({ controller: '/certificate' })
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
          regulator: (await getMemberPromise(cert.regulator)).alias,
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
    @Body()
    {
      hydrogen_quantity_mwh,
      energy_owner,
      regulator,
      production_start_time,
      production_end_time,
      energy_consumed_mwh,
    }: Certificate.Payload
  ): Promise<Certificate.GetCertificateResponse> {
    this.log.trace({ identity: this.identity, energy_owner, regulator })

    if (production_end_time <= production_start_time) {
      throw new BadRequest('Production end time must be greater than start time')
    }

    const identities = {
      hydrogen_owner: await this.identity.getMemberBySelf(),
      energy_owner: await this.identity.getMemberByAlias(energy_owner),
      regulator: await this.identity.getMemberByAlias(regulator),
    }

    const { salt, digest } = await this.commitment.build({
      production_start_time,
      production_end_time,
      energy_consumed_mwh,
    })

    // errors: handled by middlewar, thrown by the library e.g. this.lib.fn()
    const [certificate] = await this.db.insert('certificate', {
      hydrogen_quantity_mwh,
      hydrogen_owner: identities.hydrogen_owner.address,
      energy_owner: identities.energy_owner.address,
      regulator: identities.regulator.address,
      latest_token_id: null,
      original_token_id: null,
      production_start_time,
      production_end_time,
      energy_consumed_mwh,
      commitment_salt: salt,
      commitment: digest,
    })

    if (!certificate) throw new InternalServerError()

    return {
      ...certificate,
      hydrogen_owner: identities.hydrogen_owner.alias,
      energy_owner: identities.energy_owner.alias,
      regulator: identities.regulator.alias,
      production_start_time: production_start_time,
      production_end_time: production_end_time,
      energy_consumed_mwh,
      commitment_salt: salt,
      commitment: digest,
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
   * @summary updates certificate by id
   * @example id "52907745-7672-470e-a803-a2f8feb52944"
   */
  @Response<ValidateError>(422, 'Validation Failed')
  @Response<NotFound>(404, '<item> not found')
  @Response<BadRequest>(400, 'ID must be supplied in UUID format')
  @Put('{id}')
  public async updateById(
    @Path() id: UUID,
    @Body() { commitment_salt, ...update }: Certificate.UpdatePayload
  ): Promise<Certificate.GetCertificateResponse> {
    if (!id) throw new BadRequest()

    const [certificate]: CertificateRow[] = await this.db.get('certificate', { id })
    if (!certificate) throw new NotFound(id)
    if (update.production_end_time <= update.production_start_time)
      throw new BadRequest('Production end time must be greater than start time')
    if (certificate.commitment_salt) throw new BadRequest('Commitment has already been applied')

    if (!this.commitment.validate(update, commitment_salt, certificate.commitment))
      throw new BadRequest('Commitment did not match update')

    const updated = await this.db.update('certificate', { id }, { commitment_salt, ...update })
    const updatedWithAliases = await this.mapIdentities(updated)
    if (updatedWithAliases.length !== 1) throw new InternalServerError('Unknown error updating commitment')
    return updatedWithAliases[0]
  }

  /**
   * @summary returns certificate transaction by certificate and transaction ids
   * @example id "52907745-7672-470e-a803-a2f8feb52944"
   */
  @Response<ValidateError>(422, 'Validation Failed')
  @Response<NotFound>(404, '<item> not found')
  @Response<BadRequest>(400, 'ID must be supplied in UUID format')
  @Get('{id}/initiation/{transactionId}')
  public async getInitiationTransaction(
    @Path() id: UUID,
    transactionId: UUID
  ): Promise<Certificate.GetTransactionResponse> {
    if (!id || !transactionId) throw new BadRequest()

    const [transaction] = await this.db.get('transaction', {
      local_id: id,
      id: transactionId,
      api_type: 'certificate',
      transaction_type: 'initiate_cert',
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
  public async getInitiationTransactions(@Path() id: UUID): Promise<Certificate.ListTransactionResponse> {
    if (!id) throw new BadRequest()
    return await this.db.get('transaction', {
      local_id: id,
      api_type: 'certificate',
      transaction_type: 'initiate_cert',
    })
  }

  /**
   * Create a initiated version of the certificate on-chain
   * @summary Initialise a new certificate on-chain
   * @param demandAId The certificate's identifier
   */
  @Post('{id}/initiation')
  @Response<NotFound>(404, 'Item not found')
  @SuccessResponse('201')
  public async createOnChain(@Path() id: UUID): Promise<Certificate.GetTransactionResponse> {
    const { address: self_address } = await this.identity.getMemberBySelf()

    const [certificate] = await this.db.get('certificate', { id })
    if (certificate.state !== 'pending') throw new BadRequest('certificate must not be issued or revoked')
    if (certificate.hydrogen_owner !== self_address)
      throw new BadRequest('can only initialise certificates owned by self')

    const extrinsic = await this.node.prepareRunProcess(processInitiateCert(certificate))
    const [transaction] = await this.db.insert('transaction', {
      api_type: 'certificate',
      local_id: certificate.id,
      hash: extrinsic.hash.toHex(),
      transaction_type: 'initiate_cert',
    })
    if (!transaction) throw new InternalServerError('Transaction must exist')

    this.node.submitRunProcess(extrinsic, (state: TransactionState) =>
      this.db.update('transaction', { id: transaction.id }, { state })
    )

    return transaction
  }

  /**
   * @summary returns certificate transaction by certificate and transaction ids
   * @example id "52907745-7672-470e-a803-a2f8feb52944"
   */
  @Response<ValidateError>(422, 'Validation Failed')
  @Response<NotFound>(404, '<item> not found')
  @Response<BadRequest>(400, 'ID must be supplied in UUID format')
  @Get('{id}/issuance/{transactionId}')
  public async getIssuanceTransaction(
    @Path() id: UUID,
    transactionId: UUID
  ): Promise<Certificate.GetTransactionResponse> {
    if (!id || !transactionId) throw new BadRequest()

    const [transaction] = await this.db.get('transaction', {
      local_id: id,
      id: transactionId,
      api_type: 'certificate',
      transaction_type: 'issue_cert',
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
  @Get('{id}/issuance')
  public async getIssuanceTransactions(@Path() id: UUID): Promise<Certificate.ListTransactionResponse> {
    if (!id) throw new BadRequest()
    return await this.db.get('transaction', { local_id: id, api_type: 'certificate', transaction_type: 'issue_cert' })
  }

  /**
   * Update a certificate on-chain to include
   * @summary updates initiated certitificate status to issued on chain
   * along with the embodied_co2
   * @param id the local certificate's identifier
   */
  @Post('{id}/issuance')
  @Response<NotFound>(404, 'Item not found')
  @SuccessResponse('201')
  public async issueOnChain(
    @Path() id: UUID,
    @Body() body: Certificate.IssuancePayload
  ): Promise<Certificate.GetTransactionResponse> {
    const { address: self_address } = await this.identity.getMemberBySelf()

    const [certificate] = await this.db.get('certificate', { id })
    if (!certificate) throw new NotFound(id)
    if (certificate.state !== 'initiated') throw new BadRequest('certificate must be initiated to issue')
    if (certificate.energy_owner !== self_address)
      throw new BadRequest('can only issue certificates where self is the energy_owner')
    if (
      !certificate.commitment ||
      !certificate.production_start_time ||
      !certificate.production_end_time ||
      !certificate.energy_consumed_mwh
    )
      throw new BadRequest('can only issue certificates with a valid commitment')

    let embodied_co2: number
    if (body.embodied_co2 !== undefined) {
      embodied_co2 = body.embodied_co2
    } else {
      embodied_co2 = await this.emissionCalculator.fetchEmissions(
        certificate.production_start_time,
        certificate.production_end_time,
        certificate.energy_consumed_mwh
      )
    }

    const extrinsic = await this.node.prepareRunProcess(
      processIssueCert({
        ...certificate,
        embodied_co2,
      })
    )
    const [transaction] = await this.db.insert('transaction', {
      api_type: 'certificate',
      local_id: certificate.id,
      hash: extrinsic.hash.toHex(),
      transaction_type: 'issue_cert',
    })
    if (!transaction) throw new InternalServerError('Transaction must exist')

    this.node.submitRunProcess(extrinsic, (state: TransactionState) =>
      this.db.update('transaction', { id: transaction.id }, { state })
    )

    return transaction
  }

  /**
   * @summary returns certificate transaction by certificate and transaction id
   * @param id - the local certificate's identifier
   * @example id "52907745-7672-470e-a803-a2f8feb52944"
   */
  @Response<ValidateError>(422, 'Validation Failed')
  @Response<NotFound>(404, '<item> not found')
  @Response<BadRequest>(400, 'ID must be supplied in UUID format')
  @Get('{id}/revocation/{transactionId}')
  public async getRevocationTransaction(
    @Path() id: UUID,
    transactionId: UUID
  ): Promise<Certificate.GetTransactionResponse> {
    if (!id || !transactionId) throw new BadRequest()

    const [transaction] = await this.db.get('transaction', {
      local_id: id,
      id: transactionId,
      api_type: 'certificate',
      transaction_type: 'revoke_cert',
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
  @Get('{id}/revocation')
  public async getRevocationTransactions(@Path() id: UUID): Promise<Certificate.ListTransactionResponse> {
    if (!id) throw new BadRequest()
    return await this.db.get('transaction', { local_id: id, api_type: 'certificate', transaction_type: 'revoke_cert' })
  }

  /**
   * Updates a certificate on-chain to include
   * @summary changes issued certificate to revoked
   * @param id - the local certificate's identifier
   */
  @Post('{id}/revocation')
  @Response<NotFound>(404, 'Item not found')
  @SuccessResponse('201')
  public async revokeOnChain(
    @Path() id: UUID,
    @Body() { reason }: Certificate.RevokePayload
  ): Promise<Certificate.GetTransactionResponse> {
    const { address: self_address } = await this.identity.getMemberBySelf()
    const [certificate] = await this.db.get('certificate', { id })

    if (!certificate) throw new NotFound(id)
    if (certificate.state !== 'issued') throw new BadRequest('certificate must be issued to revoke')
    if (certificate.regulator !== self_address) throw new BadRequest('certificates can be revoked only by a regulator')

    const [attachment] = await this.db.get('attachment', { id: reason })
    if (!attachment) throw new NotFound(reason)

    const extrinsic = await this.node.prepareRunProcess(processRevokeCert(certificate, attachment))
    const [transaction] = await this.db.insert('transaction', {
      api_type: 'certificate',
      local_id: certificate.id,
      hash: extrinsic.hash.toHex(),
      transaction_type: 'revoke_cert',
    })
    if (!transaction) throw new InternalServerError('Transaction must exist')

    this.node.submitRunProcess(extrinsic, (state: TransactionState) =>
      this.db.update('transaction', { id: transaction.id }, { state })
    )

    return transaction
  }
}
