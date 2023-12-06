import { describe } from 'mocha'
import { expect } from 'chai'
import { Express } from 'express'
import { container } from 'tsyringe'

import Indexer from '../../../src/lib/indexer'
import { withIdentitySelfMock } from '../../helpers/mock'
import { withAppAndIndexer } from '../../helpers/chainTest'
import Database from '../../../src/lib/db'
import ChainNode from '../../../src/lib/chainNode'
import { pollTransactionState } from '../../helpers/poll'

describe('on-chain', function () {
  this.timeout(120000)

  const db = new Database()
  const node = container.resolve(ChainNode)

  const context: { app: Express; indexer: Indexer } = {} as { app: Express; indexer: Indexer }
  withAppAndIndexer(context)
  withIdentitySelfMock()

  beforeEach(async function () {
    await db.delete('transaction', {})
  })

  afterEach(async function () {
    await db.delete('transaction', {})
  })

  describe('chainNode', () => {
    it('should set transaction as failed if dispatch error', async () => {
      const invalidProcess = { id: 'invalid', version: 1 }
      const extrinsic = await node.prepareRunProcess({ process: invalidProcess, inputs: [], outputs: [] })
      const [transaction]: any = await db.insert('transaction', {
        api_type: 'certificate',
        local_id: '0f5af074-7d4d-40b4-86a5-17a2391303cb',
        state: 'submitted',
        hash: extrinsic.hash.toHex().slice(2),
        transaction_type: 'initiate_cert',
      })

      node.submitRunProcess(extrinsic, (state) => db.update('transaction', { id: transaction.id }, { state }))

      // wait for dispatch error
      const failedTransaction = await pollTransactionState(db, transaction.id, 'failed')
      expect(failedTransaction.state).to.equal('failed')
    })
  })
})
