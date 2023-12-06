import 'reflect-metadata'

import { describe, beforeEach, afterEach, it } from 'mocha'
import { Express } from 'express'
import { expect } from 'chai'

import Indexer from '../../../src/lib/indexer'
import { post } from '../../helpers/routeHelper'
import { seed, cleanup } from '../../seeds/certificate'

import { selfAddress, notSelfAddress, notSelfAlias, withIdentitySelfMock } from '../../helpers/mock'
import Database from '../../../src/lib/db'
import ChainNode from '../../../src/lib/chainNode'
import { pollTransactionState } from '../../helpers/poll'
import { withAppAndIndexer } from '../../helpers/chainTest'

describe('on-chain', function () {
  this.timeout(60000)
  const db = new Database()
  const node = new ChainNode()
  const context: { app: Express; indexer: Indexer } = {} as { app: Express; indexer: Indexer }

  withAppAndIndexer(context)

  withIdentitySelfMock()

  beforeEach(async function () {
    await seed()
  })

  afterEach(async function () {
    await cleanup()
  })

  describe('certificate', () => {
    it('creates an certificate on chain', async () => {
      const lastTokenId = await node.getLastTokenId()
      const {
        body: { id: certId },
      } = await post(context.app, '/v1/certificate', {
        energy_owner: notSelfAlias,
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
})
