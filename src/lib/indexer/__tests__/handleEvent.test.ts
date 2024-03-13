import { describe, it } from 'mocha'
import { expect } from 'chai'
import { SinonStub } from 'sinon'

import EventHandler from '../handleEvent.js'
import { withTransactionMatchingTokensInDb } from './fixtures/db.js'
import { withMockLogger } from './fixtures/logger.js'
import { withGetTokenResponses } from './fixtures/chainNode.js'
import { withMockEventProcessors } from './fixtures/eventProcessor.js'
import { invalidProcess, noInputsOutputs, complexEvent } from './fixtures/event.js'
import { ChangeSet } from '../changeSet.js'

describe('EventHandler', function () {
  it('should throw an exception if the process name is invalid', async function () {
    const db = withTransactionMatchingTokensInDb(null, new Map())
    const logger = withMockLogger()
    const node = withGetTokenResponses('0x01', new Set())
    const eventProcessors = withMockEventProcessors()
    const eventHandler = new EventHandler({ db, logger, node, eventProcessors })

    let thrown: Error | null = null
    try {
      await eventHandler.handleEvent(invalidProcess, {})
    } catch (err) {
      thrown = err instanceof Error ? err : null
    }
    expect(thrown).instanceOf(Error)
  })

  it('should fetch the transaction from the db and pass to the correct eventProcessor', async function () {
    const tx = { x: Symbol('tx') }
    const db = withTransactionMatchingTokensInDb(tx, new Map())
    const logger = withMockLogger()
    const node = withGetTokenResponses('0x01', new Set())
    const eventProcessors = withMockEventProcessors()
    const eventHandler = new EventHandler({ db, logger, node, eventProcessors })

    const result = await eventHandler.handleEvent(noInputsOutputs, {})
    expect(result).to.deep.equal({})

    const stub = eventProcessors['initiate_cert'] as SinonStub
    expect(stub.calledOnce).to.equal(true)
    expect(stub.firstCall.args).to.deep.equal([
      { version: 1, transaction: tx, sender: 'alice', inputs: [], outputs: [] },
    ])
  })

  it('should map inputs to local_id using the db', async function () {
    const db = withTransactionMatchingTokensInDb(
      null,
      new Map([
        [1, '1'],
        [2, '2'],
        [3, '3'],
      ])
    )
    const logger = withMockLogger()
    const node = withGetTokenResponses('0x01', new Set([4, 5, 6]))
    const eventProcessors = withMockEventProcessors()
    const eventHandler = new EventHandler({ db, logger, node, eventProcessors })

    const result = await eventHandler.handleEvent(complexEvent, {})
    expect(result).to.deep.equal({})

    const stub = eventProcessors['initiate_cert'] as SinonStub
    expect(stub.calledOnce).to.equal(true)
    expect(stub.firstCall.args).to.deep.equal([
      {
        version: 1,
        sender: 'alice',
        inputs: [
          { id: 1, local_id: '1' },
          { id: 2, local_id: '2' },
          { id: 3, local_id: '3' },
        ],
        transaction: null,
        outputs: [
          { id: 4, roles: new Map(), metadata: new Map() },
          { id: 5, roles: new Map(), metadata: new Map() },
          { id: 6, roles: new Map(), metadata: new Map() },
        ],
      },
    ])
  })

  it('should prefer ChangeSet to db', async function () {
    const db = withTransactionMatchingTokensInDb(
      null,
      new Map([
        [1, '1'],
        [2, '2'],
        [3, '3'],
      ])
    )
    const logger = withMockLogger()
    const node = withGetTokenResponses('0x01', new Set([4, 5, 6]))
    const eventProcessors = withMockEventProcessors()
    const eventHandler = new EventHandler({ db, logger, node, eventProcessors })

    const baseChangeSet: ChangeSet = {
      certificates: new Map([
        ['7', { type: 'update', id: '7', latest_token_id: 1, state: 'initiated' }],
        ['8', { type: 'update', id: '8', latest_token_id: 2, state: 'initiated' }],
        ['9', { type: 'update', id: '9', latest_token_id: 3, state: 'initiated' }],
      ]),
    }

    const result = await eventHandler.handleEvent(complexEvent, baseChangeSet)
    expect(result).to.deep.equal(baseChangeSet)

    const stub = eventProcessors['initiate_cert'] as SinonStub
    expect(stub.calledOnce).to.equal(true)

    expect(stub.firstCall.args).to.deep.equal([
      {
        version: 1,
        transaction: null,
        sender: 'alice',
        inputs: [
          { id: 1, local_id: '7' },
          { id: 2, local_id: '8' },
          { id: 3, local_id: '9' },
        ],
        outputs: [
          { id: 4, roles: new Map(), metadata: new Map() },
          { id: 5, roles: new Map(), metadata: new Map() },
          { id: 6, roles: new Map(), metadata: new Map() },
        ],
      },
    ])
  })

  it('should return a merged ChangeSet', async function () {
    const resultChangeSet: ChangeSet = {
      attachments: new Map([['10', { type: 'insert', id: '10', ipfs_hash: '42', filename: null, size: null }]]),
    }
    const db = withTransactionMatchingTokensInDb(null, new Map())
    const logger = withMockLogger()
    const node = withGetTokenResponses('0x01', new Set([4, 5, 6]))
    const eventProcessors = withMockEventProcessors(resultChangeSet)
    const eventHandler = new EventHandler({ db, logger, node, eventProcessors })

    const baseChangeSet: ChangeSet = {
      certificates: new Map([
        ['7', { type: 'update', id: '7', latest_token_id: 1, state: 'initiated' }],
        ['8', { type: 'update', id: '8', latest_token_id: 2, state: 'initiated' }],
        ['9', { type: 'update', id: '9', latest_token_id: 3, state: 'initiated' }],
      ]),
    }

    const result = await eventHandler.handleEvent(complexEvent, baseChangeSet)
    expect(result).to.deep.equal({
      ...resultChangeSet,
      ...baseChangeSet,
    })
  })
})
