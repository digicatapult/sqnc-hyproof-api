import { expect } from 'chai'
import sinon from 'sinon'

import Database from '../../../../lib/db/index.js'
import { TransactionController } from '../index.js'
import { TransactionState } from '../../../../models/transaction.js'
import { NotFound } from '../../../../lib/error-handler/index.js'

export const example = {
  id: 'transaction-controller-test',
  api_type: 'certificate',
  local_id: 'test-cert-1',
  state: 'submitted',
  transaction_type: 'initiate_cert',
}

describe('v1/transaction', () => {
  let response: any
  let controller: TransactionController

  const database: Database = new Database()
  const getStub = sinon.stub(database, 'get' as any).callsFake(() => [{ ...example, id: 'test-1' }, example])

  before(() => {
    controller = new TransactionController(database)
  })

  afterEach(() => {
    getStub.resetHistory()
  })

  describe('get() - GET /', () => {
    describe('query by api_type', () => {
      ;['certificate'].forEach((api_type: any) => {
        it(` - [${api_type}]`, async () => {
          response = await controller.get(api_type)

          expect(getStub.lastCall.args[0]).to.equal('transaction')
          expect(getStub.lastCall.args[1]).to.to.deep.contain({ api_type })
          expect(response[1]).to.deep.contain(example)
        })
      })
    })

    describe('query by transaction state', () => {
      ;['submitted', 'inBlock', 'finalised', 'failed'].forEach((state) => {
        it(`returns transactions based on state - [${state}]`, async () => {
          response = await controller.get(undefined, state as TransactionState)

          expect(getStub.lastCall.args[0]).to.equal('transaction')
          expect(response[1]).to.deep.contain(example)
        })
      })
    })

    it('returns transactions by updated_since query param', async () => {
      response = await controller.get(undefined, undefined, '2024-01-10')

      expect(getStub.lastCall.args[0]).to.equal('transaction')
    })

    it('returns all transactions without filters', () => {
      expect(response.length).to.equal(2)
    })
  })

  describe('getById() - GET /{id}', () => {
    beforeEach(async () => {
      getStub.callsFake((_, args) => [{ ...example, ...args }])
      response = await controller.getById('test-id').catch((err) => err)
    })

    describe('if transaction can not be found', () => {
      beforeEach(async () => {
        getStub.callsFake(() => [])

        response = await controller.getById('not-found-transaction-id').catch((err) => err)
      })

      it('throws NotFound error', () => {
        expect(response).to.be.instanceOf(NotFound)
        expect(response.code).to.equal(404)
        expect(response.message).to.equal('transaction [not-found-transaction-id] not found')
      })
    })

    it('returns transaction by id', async () => {
      expect(response).to.deep.contain({
        id: 'test-id',
        api_type: 'certificate',
        local_id: 'test-cert-1',
        state: 'submitted',
        transaction_type: 'initiate_cert',
      })
    })
  })
})
