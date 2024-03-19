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

import { logger } from '../../../lib/logger.js'
import { CertificateRow, Where } from '../../../lib/db/types.js'
import Database from '../../../lib/db/index.js'
import { BadRequest, InternalServerError, NotFound } from '../../../lib/error-handler/index.js'
import Identity from '../../../lib/services/identity.js'
import type {
  InitiatePayload,
  GetCertificateResponse,
  ListCertificatesResponse,
  UpdatePayload,
  IssuancePayload,
  RevokePayload,
} from '../../../models/certificate.js'
import type { GetTransactionResponse, ListTransactionResponse } from '../../../models/transaction.js'
import type { DATE, UUID } from '../../../models/strings.js'
import type { INT } from '../../../models/numbers.js'
import ChainNode from '../../../lib/chainNode.js'
import { processInitiateCert, processIssueCert, processRevokeCert } from '../../../lib/payload.js'
import { TransactionState } from '../../../models/transaction.js'
import Commitment from '../../../lib/services/commitment.js'
import EmissionsCalculator from '../../../lib/services/emissionsCalculator.js'

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

  private async mapIdentity(cert: CertificateRow): Promise<CertificateRow> {
    return (await this.mapIdentities([cert]))[0]
  }

  private transformCertNumbers(cert: CertificateRow) {
    return {
      ...cert,
      hydrogen_quantity_wh: Number.parseFloat(cert.hydrogen_quantity_wh),
      energy_consumed_wh: cert.energy_consumed_wh === null ? null : Number.parseFloat(cert.energy_consumed_wh),
      embodied_co2: cert.embodied_co2 === null ? null : Number.parseFloat(cert.embodied_co2),
    }
  }

  private async getCertificate(idOrOrigToken: UUID | number): Promise<CertificateRow> {
    const condition = typeof idOrOrigToken === 'number' ? { original_token_id: idOrOrigToken } : { id: idOrOrigToken }
    const [certificate]: CertificateRow[] = await this.db.get('certificate', condition)
    if (!certificate) throw new NotFound('' + idOrOrigToken)
    return certificate
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
      hydrogen_quantity_wh,
      energy_owner,
      regulator,
      production_start_time,
      production_end_time,
      energy_consumed_wh,
    }: InitiatePayload
  ): Promise<GetCertificateResponse> {
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
      energy_consumed_wh,
    })

    // errors: handled by middlewar, thrown by the library e.g. this.lib.fn()
    const [certificate] = await this.db.insert('certificate', {
      hydrogen_quantity_wh: BigInt(hydrogen_quantity_wh).toString(),
      hydrogen_owner: identities.hydrogen_owner.address,
      energy_owner: identities.energy_owner.address,
      regulator: identities.regulator.address,
      latest_token_id: null,
      original_token_id: null,
      production_start_time,
      production_end_time,
      energy_consumed_wh: BigInt(energy_consumed_wh).toString(),
      commitment_salt: salt,
      commitment: digest,
    })
    if (!certificate) throw new InternalServerError()

    return {
      ...this.transformCertNumbers(certificate),
      hydrogen_owner: identities.hydrogen_owner.alias,
      energy_owner: identities.energy_owner.alias,
      regulator: identities.regulator.alias,
      energy_consumed_wh,
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
  public async getAll(@Query() created_after?: DATE, @Query() updated_after?: DATE): Promise<ListCertificatesResponse> {
    const where: Where<'certificate'> = []
    if (created_after) where.push(['created_at', '>=', new Date(created_after)])
    if (updated_after) where.push(['updated_at', '>=', new Date(updated_after)])

    const found = await this.db.get('certificate', where)
    const certificates = await this.mapIdentities(found)

    return certificates.map(this.transformCertNumbers)
  }

  /**
   * @summary returns certificate by id
   * @param id the local certificate's id or original_token_id
   * @example id "52907745-7672-470e-a803-a2f8feb52944"
   */
  @Response<ValidateError>(422, 'Validation Failed')
  @Response<NotFound>(404, '<item> not found')
  @Response<BadRequest>(400, 'ID must be a UUID or a positive integer')
  @Get('{id}')
  public async getById(@Path() id: UUID | INT): Promise<GetCertificateResponse> {
    if (!id) throw new BadRequest()
    const certificate = await this.getCertificate(id).then((c) => this.mapIdentity(c))
    return this.transformCertNumbers(certificate)
  }

  /**
   * @summary updates certificate by id
   * @param id the local certificate's id or original_token_id
   * @example id "52907745-7672-470e-a803-a2f8feb52944"
   */
  @Response<ValidateError>(422, 'Validation Failed')
  @Response<NotFound>(404, '<item> not found')
  @Response<BadRequest>(400, 'ID must be a UUID or a positive integer')
  @Put('{id}')
  public async updateById(
    @Path() id: UUID | INT,
    @Body() { commitment_salt, ...update }: UpdatePayload
  ): Promise<GetCertificateResponse> {
    if (!id) throw new BadRequest()

    const certificate = await this.getCertificate(id)
    if (update.production_end_time <= update.production_start_time)
      throw new BadRequest('Production end time must be greater than start time')
    if (certificate.commitment_salt) throw new BadRequest('Commitment has already been applied')

    if (!this.commitment.validate(update, commitment_salt, certificate.commitment))
      throw new BadRequest('Commitment did not match update')

    const updated = await this.db.update(
      'certificate',
      { id: certificate.id },
      { ...update, commitment_salt, energy_consumed_wh: BigInt(update.energy_consumed_wh).toString() }
    )
    const updatedWithAliases = await this.mapIdentities(updated)
    if (updatedWithAliases.length !== 1) throw new InternalServerError('Unknown error updating commitment')
    return this.transformCertNumbers(updatedWithAliases[0])
  }

  /**
   * @summary returns certificate transaction by certificate and transaction ids
   * @param id the local certificate's id or original_token_id
   * @example id "52907745-7672-470e-a803-a2f8feb52944"
   */
  @Response<ValidateError>(422, 'Validation Failed')
  @Response<NotFound>(404, '<item> not found')
  @Response<BadRequest>(400, 'ID must be a UUID or a positive integer')
  @Get('{id}/initiation/{transactionId}')
  public async getInitiationTransaction(@Path() id: UUID | INT, transactionId: UUID): Promise<GetTransactionResponse> {
    if (!id || !transactionId) throw new BadRequest()
    const certificate = await this.getCertificate(id)

    const [transaction] = await this.db.get('transaction', {
      local_id: certificate.id,
      id: transactionId,
      api_type: 'certificate',
      transaction_type: 'initiate_cert',
    })
    if (!transaction) throw new NotFound(transactionId)
    return transaction
  }

  /**
   * @summary returns transactions by certificate local id
   * @param id the local certificate's id or original_token_id
   * @example id "52907745-7672-470e-a803-a2f8feb52944"
   */
  @Response<ValidateError>(422, 'Validation Failed')
  @Response<NotFound>(404, '<item> not found')
  @Response<BadRequest>(400, 'ID must be a UUID or a positive integer')
  @Get('{id}/initiation')
  public async getInitiationTransactions(@Path() id: UUID | INT): Promise<ListTransactionResponse> {
    if (!id) throw new BadRequest()
    const certificate = await this.getCertificate(id)
    return await this.db.get('transaction', {
      local_id: certificate.id,
      api_type: 'certificate',
      transaction_type: 'initiate_cert',
    })
  }

  /**
   * Create a initiated version of the certificate on-chain
   * @summary Initialise a new certificate on-chain
   * @param id the local certificate's id or original_token_id
   * @param demandAId The certificate's identifier
   */
  @Post('{id}/initiation')
  @Response<NotFound>(404, 'Item not found')
  @SuccessResponse('201')
  public async createOnChain(@Path() id: UUID | INT): Promise<GetTransactionResponse> {
    const { address: self_address } = await this.identity.getMemberBySelf()

    const certificate = await this.getCertificate(id)
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
    await this.node.submitRunProcess(extrinsic, (state: TransactionState) =>
      this.db.update('transaction', { id: transaction.id }, { state })
    )

    return transaction
  }

  /**
   * @summary returns certificate transaction by certificate and transaction ids
   * @param id the local certificate's id or original_token_id
   * @example id "52907745-7672-470e-a803-a2f8feb52944"
   */
  @Response<ValidateError>(422, 'Validation Failed')
  @Response<NotFound>(404, '<item> not found')
  @Response<BadRequest>(400, 'ID must be a UUID or a positive integer')
  @Get('{id}/issuance/{transactionId}')
  public async getIssuanceTransaction(@Path() id: UUID | INT, transactionId: UUID): Promise<GetTransactionResponse> {
    if (!id || !transactionId) throw new BadRequest()

    const certificate = await this.getCertificate(id)
    const [transaction] = await this.db.get('transaction', {
      local_id: certificate.id,
      id: transactionId,
      api_type: 'certificate',
      transaction_type: 'issue_cert',
    })
    if (!transaction) throw new NotFound(transactionId)
    return transaction
  }

  /**
   * @summary returns transactions by certificate local id
   * @param id the local certificate's id or original_token_id
   * @example id "52907745-7672-470e-a803-a2f8feb52944"
   */
  @Response<ValidateError>(422, 'Validation Failed')
  @Response<NotFound>(404, '<item> not found')
  @Response<BadRequest>(400, 'ID must be a UUID or a positive integer')
  @Get('{id}/issuance')
  public async getIssuanceTransactions(@Path() id: UUID | INT): Promise<ListTransactionResponse> {
    if (!id) throw new BadRequest()
    const certificate = await this.getCertificate(id)
    return await this.db.get('transaction', {
      local_id: certificate.id,
      api_type: 'certificate',
      transaction_type: 'issue_cert',
    })
  }

  /**
   * Update a certificate on-chain to include
   * @summary updates initiated certificate status to issued on chain
   * along with the embodied_co2
   * @param id the local certificate's id or original_token_id
   */
  @Post('{id}/issuance')
  @Response<NotFound>(404, 'Item not found')
  @SuccessResponse('201')
  public async issueOnChain(@Path() id: UUID | INT, @Body() body: IssuancePayload): Promise<GetTransactionResponse> {
    const { address: self_address } = await this.identity.getMemberBySelf()

    const certificate = await this.getCertificate(id)
    if (certificate.state !== 'initiated') throw new BadRequest('certificate must be initiated to issue')
    if (certificate.energy_owner !== self_address)
      throw new BadRequest('can only issue certificates where self is the energy_owner')
    if (
      !certificate.commitment ||
      !certificate.production_start_time ||
      !certificate.production_end_time ||
      !certificate.energy_consumed_wh
    )
      throw new BadRequest('can only issue certificates with a valid commitment')

    let embodied_co2: string
    if (body.embodied_co2 !== undefined) {
      embodied_co2 = BigInt(body.embodied_co2).toString()
    } else {
      const asNumber = await this.emissionCalculator.fetchEmissions(
        certificate.production_start_time,
        certificate.production_end_time,
        Number.parseFloat(certificate.energy_consumed_wh)
      )
      embodied_co2 = BigInt(asNumber).toString()
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

    await this.node.submitRunProcess(extrinsic, (state: TransactionState) =>
      this.db.update('transaction', { id: transaction.id }, { state })
    )

    return transaction
  }

  /**
   * @summary returns certificate transaction by certificate id/original_token_id and transaction id
   * @param id the local certificate's id or original_token_id
   * @example id "52907745-7672-470e-a803-a2f8feb52944"
   */
  @Response<ValidateError>(422, 'Validation Failed')
  @Response<NotFound>(404, '<item> not found')
  @Response<BadRequest>(400, 'ID must be a UUID or a positive integer')
  @Get('{id}/revocation/{transactionId}')
  public async getRevocationTransaction(@Path() id: UUID | INT, transactionId: UUID): Promise<GetTransactionResponse> {
    if (!id || !transactionId) throw new BadRequest()

    const certificate = await this.getCertificate(id)
    const [transaction] = await this.db.get('transaction', {
      local_id: certificate.id,
      id: transactionId,
      api_type: 'certificate',
      transaction_type: 'revoke_cert',
    })
    if (!transaction) throw new NotFound(transactionId)
    return transaction
  }

  /**
   * @summary returns transactions by certificate local id or original_token_id
   * @param id the local certificate's id or original_token_id
   * @example id "52907745-7672-470e-a803-a2f8feb52944"
   */
  @Response<ValidateError>(422, 'Validation Failed')
  @Response<NotFound>(404, '<item> not found')
  @Response<BadRequest>(400, 'ID must be a UUID or a positive integer')
  @Get('{id}/revocation')
  public async getRevocationTransactions(@Path() id: UUID | INT): Promise<ListTransactionResponse> {
    if (!id) throw new BadRequest()
    const certificate = await this.getCertificate(id)
    return await this.db.get('transaction', {
      local_id: certificate.id,
      api_type: 'certificate',
      transaction_type: 'revoke_cert',
    })
  }

  /**
   * Updates a certificate on-chain to include
   * @summary changes issued certificate to revoked
   * @param id the local certificate's id or original_token_id
   */
  @Post('{id}/revocation')
  @Response<NotFound>(404, 'Item not found')
  @SuccessResponse('201')
  public async revokeOnChain(
    @Path() id: UUID | INT,
    @Body() { reason }: RevokePayload
  ): Promise<GetTransactionResponse> {
    const { address: self_address } = await this.identity.getMemberBySelf()

    const certificate = await this.getCertificate(id)
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

    await this.node.submitRunProcess(extrinsic, (state: TransactionState) =>
      this.db.update('transaction', { id: transaction.id }, { state })
    )

    return transaction
  }
}
