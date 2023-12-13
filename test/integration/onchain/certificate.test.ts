import 'reflect-metadata'
import { container } from 'tsyringe'

import { describe, beforeEach, afterEach, it } from 'mocha'
import { Express } from 'express'
import { expect } from 'chai'

import Indexer from '../../../src/lib/indexer'
import { post, postFile } from '../../helpers/routeHelper'
import { seed, cleanup } from '../../seeds/certificate'

import {
  selfAddress,
  notSelfAddress,
  notSelfAlias,
  withExternalServicesMock,
  regulatorAlias,
  regulatorAddress,
} from '../../helpers/mock'
import Database from '../../../src/lib/db'
import { CertificateRow } from '../../../src/lib/db/types'
import ChainNode from '../../../src/lib/chainNode'
import { pollTransactionState } from '../../helpers/poll'
import { withAppAndIndexer, withInitialisedCertFromNotSelf } from '../../helpers/chainTest'

describe('on-chain', function () {
  this.timeout(60000)
  let issuedCert: CertificateRow
  const db = new Database()
  const node = container.resolve(ChainNode)
  const context: { app: Express; indexer: Indexer; cert: CertificateRow } = {} as {
    app: Express
    indexer: Indexer
    cert: CertificateRow
  }

  withAppAndIndexer(context)

  withExternalServicesMock()

  beforeEach(async function () {
    await seed()
  })

  afterEach(async function () {
    await cleanup()
  })

  describe('certificate', () => {
    describe('initiation', function () {
      it('creates an certificate on chain', async () => {
        const lastTokenId = await node.getLastTokenId()
        const {
          body: { id: certId },
        } = await post(context.app, '/v1/certificate', {
          energy_owner: notSelfAlias,
          regulator: regulatorAlias,
          hydrogen_quantity_mwh: 1,
          production_start_time: new Date('2023-12-01T00:00:00.000Z'),
          production_end_time: new Date('2023-12-02T00:00:00.000Z'),
          energy_consumed_mwh: 2,
        })

        // submit to chain
        const response = await post(context.app, `/v1/certificate/${certId}/initiation`, {})
        expect(response.status).to.equal(201)

        const { id: transactionId, state } = response.body
        expect(transactionId).to.match(
          /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89ABab][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/
        )
        expect(state).to.equal('submitted')

        await pollTransactionState(db, transactionId, 'finalised')

        const [cert] = await db.get('certificate', { id: certId })
        expect(cert).to.deep.contain({
          id: certId,
          energy_owner: notSelfAddress,
          hydrogen_owner: selfAddress,
          regulator: regulatorAddress,
          hydrogen_quantity_mwh: 1,
          state: 'initiated',
          embodied_co2: null,
          latest_token_id: lastTokenId + 1,
          original_token_id: lastTokenId + 1,
          production_start_time: new Date('2023-12-01T00:00:00.000Z'),
          production_end_time: new Date('2023-12-02T00:00:00.000Z'),
          energy_consumed_mwh: 2,
        })
        expect(cert.commitment).to.match(/^[0-9a-f]{32}$/)
        expect(cert.commitment_salt).to.match(/^[0-9a-f]{32}$/)
      })
    })

    describe('issuance', function () {
      it('should issue a certificate on-chain based on supplied emissions', async function () {
        await withInitialisedCertFromNotSelf(context)

        const lastTokenId = await node.getLastTokenId()

        const response = await post(context.app, `/v1/certificate/${context.cert.id}/issuance`, {
          embodied_co2: 3,
        })
        expect(response.status).to.equal(201)

        const { id: transactionId, state } = response.body
        expect(transactionId).to.match(
          /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89ABab][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/
        )
        expect(state).to.equal('submitted')

        await pollTransactionState(db, transactionId, 'finalised')

        const [cert] = await db.get('certificate', { id: context.cert.id })
        issuedCert = cert
        expect(cert).to.deep.contain({
          id: context.cert.id,
          state: 'issued',
          embodied_co2: 3,
          latest_token_id: lastTokenId + 1,
        })
      })

      it('should issue a certificate on-chain based on grid emissions', async function () {
        await withInitialisedCertFromNotSelf(context)

        const lastTokenId = await node.getLastTokenId()

        const response = await post(context.app, `/v1/certificate/${context.cert.id}/issuance`, {})
        expect(response.status).to.equal(201)

        const { id: transactionId, state } = response.body
        expect(transactionId).to.match(
          /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89ABab][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/
        )
        expect(state).to.equal('submitted')

        await pollTransactionState(db, transactionId, 'finalised')

        const [cert] = await db.get('certificate', { id: context.cert.id })
        expect(cert).to.deep.contain({
          id: context.cert.id,
          state: 'issued',
          embodied_co2: 246913.578246,
          latest_token_id: lastTokenId + 1,
        })
      })
    })

    describe('recovation', () => {
      it('should revoke an issued certificate with a reason as an attachment', async function () {
        const { status, body } = await postFile(context.app, '/v1/attachment', Buffer.from('a'), 'filname.txt')
        const lastTokenId = await node.getLastTokenId()
        const response = await post(context.app, `/v1/certificate/${issuedCert?.id}/revocation`, {
          reason: body.id,
        })
        expect(response.status).to.equal(201)
        expect(status).to.equal(201)

        const { id: transactionId, state } = response.body
        expect(transactionId).to.match(
          /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89ABab][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/
        )
        expect(state).to.equal('submitted')

        await pollTransactionState(db, transactionId, 'finalised')

        const [cert] = await db.get('certificate', { id: issuedCert.id })
        expect(cert).to.deep.contain({
          id: issuedCert.id,
          state: 'revoked',
          reason: body.id,
          latest_token_id: lastTokenId + 1,
        })
      })
    })
  })
})
