import { describe, it } from 'mocha'
import { expect } from 'chai'
import { SinonStub } from 'sinon'

import BlockHandler from '../handleBlock.js'

import { withInitialLastProcessedBlock } from './fixtures/db.js'
import { withMockLogger } from './fixtures/logger.js'
import { events2, withProcessRanEvents } from './fixtures/chainNode.js'
import { changeSets2 } from './fixtures/changeSet.js'
import { withMockEventHandler } from './fixtures/eventHandler.js'

describe('BlockHandler', function () {
  describe('handleBlock', function () {
    it('should fetch events from node for blockHash', async function () {
      const db = withInitialLastProcessedBlock({ hash: '1-hash', parent: '0-hash', height: 1 })
      const logger = withMockLogger()
      const node = withProcessRanEvents([])
      const blockHandler = new BlockHandler({ db, logger, node })
      await blockHandler.handleBlock('0x1234')
      const stub = node.getProcessRanEvents as SinonStub
      expect(stub.calledOnce).to.equal(true)
      expect(stub.firstCall.args[0]).to.equal('0x1234')
    })

    it('should recursively process events', async function () {
      const events = events2
      const changeSets = changeSets2

      const db = withInitialLastProcessedBlock({ hash: '1-hash', parent: '0-hash', height: 1 })
      const logger = withMockLogger()
      const node = withProcessRanEvents(events)
      const eventHandler = withMockEventHandler(changeSets)
      const blockHandler = new BlockHandler({ db, logger, node, eventHandler })
      const stub = eventHandler.handleEvent as SinonStub

      const result = await blockHandler.handleBlock('0x1234')
      expect(stub.calledTwice).to.equal(true)
      expect(stub.firstCall.args).to.deep.equal([events[0], {}])
      expect(stub.secondCall.args).to.deep.equal([events[1], changeSets[0]])
      expect(result).to.deep.equal(changeSets[1])
    })
  })
})
