import { describe, it, afterEach, beforeEach } from 'mocha'
import { expect } from 'chai'
import sinon from 'sinon'

import { withMockLogger } from './fixtures/logger.js'
import { withLastProcessedBlocksByCall, withInitialLastProcessedBlock } from './fixtures/db.js'
import { withHappyChainNode, withGetHeaderBoom } from './fixtures/chainNode.js'
import Indexer from '../index.js'

describe('Indexer', function () {
  let indexer: Indexer
  const logger = withMockLogger()

  describe('start', function () {
    afterEach(async function () {
      await indexer.close()
    })

    it('should return null if the db has no processed blocks', async function () {
      const db = withInitialLastProcessedBlock(null)
      const node = withHappyChainNode()
      const handleBlock = sinon.stub().resolves({})

      indexer = new Indexer({ db, node, logger, handleBlock })
      const result = await indexer.start()
      expect(result).to.equal(null)
    })

    it('should return hash if the db has processed blocks', async function () {
      const db = withInitialLastProcessedBlock({ hash: '1-hash', parent: '0-hash', height: 1 })
      const node = withHappyChainNode()
      const handleBlock = sinon.stub().resolves({})

      indexer = new Indexer({ db, node, logger, handleBlock })
      const result = await indexer.start()
      expect(result).to.equal('0x1-hash')
    })

    it('should handle new blocks immediately', async function () {
      const db = withInitialLastProcessedBlock(null)
      const node = withHappyChainNode()
      const handleBlock = sinon.stub().resolves({})

      indexer = new Indexer({ db, node, logger, handleBlock })
      await indexer.start()
      expect(handleBlock.called).to.equal(false)
    })
  })

  describe('processNextBlock', function () {
    it('should do nothing and return null if there are no blocks to process', async function () {
      const db = withInitialLastProcessedBlock({ hash: '1-hash', parent: '0-hash', height: 1 })
      const node = withHappyChainNode()
      const handleBlock = sinon.stub().resolves({})

      indexer = new Indexer({ db, node, logger, handleBlock })
      await indexer.start()
      const result = await indexer.processNextBlock('1-hash')

      expect(result).to.equal(null)
      expect(handleBlock.called).to.equal(false)
    })

    it("should process next block and return it's hash if there's one block to process", async function () {
      const db = withInitialLastProcessedBlock({ hash: '1-hash', parent: '0-hash', height: 1 })
      const node = withHappyChainNode()
      const handleBlock = sinon.stub().resolves({})

      indexer = new Indexer({ db, node, logger, handleBlock })
      await indexer.start()
      const result = await indexer.processNextBlock('2-hash')

      expect(result).to.equal('0x2-hash')
      expect(handleBlock.calledOnce).to.equal(true)
      expect(handleBlock.firstCall.args[0]).to.equal('0x2-hash')
    })

    it("should process next block and return it's hash if there's more than one block to process", async function () {
      const db = withInitialLastProcessedBlock({ hash: '1-hash', parent: '0-hash', height: 1 })
      const node = withHappyChainNode()
      const handleBlock = sinon.stub().resolves({})

      indexer = new Indexer({ db, node, logger, handleBlock })
      await indexer.start()
      const result = await indexer.processNextBlock('3-hash')

      expect(result).to.equal('0x2-hash')
      expect(handleBlock.calledOnce).to.equal(true)
      expect(handleBlock.firstCall.args[0]).to.equal('0x2-hash')
    })

    it("should process successive blocks on each call if there's two block to process", async function () {
      const db = withInitialLastProcessedBlock({ hash: '1-hash', parent: '0-hash', height: 1 })
      const node = withHappyChainNode()
      const handleBlock = sinon.stub().resolves({})

      indexer = new Indexer({ db, node, logger, handleBlock })
      await indexer.start()
      await indexer.processNextBlock('3-hash')
      const result = await indexer.processNextBlock('3-hash')

      expect(result).to.equal('0x3-hash')
      expect(handleBlock.calledTwice).to.equal(true)
      expect(handleBlock.firstCall.args[0]).to.equal('0x2-hash')
      expect(handleBlock.secondCall.args[0]).to.equal('0x3-hash')
    })

    it("should do nothing if we're up to date after processing blocks", async function () {
      const db = withInitialLastProcessedBlock({ hash: '1-hash', parent: '0-hash', height: 1 })
      const node = withHappyChainNode()
      const handleBlock = sinon.stub().resolves({})

      indexer = new Indexer({ db, node, logger, handleBlock })
      await indexer.start()
      await indexer.processNextBlock('2-hash')
      const result = await indexer.processNextBlock('2-hash')

      expect(result).to.equal(null)
      expect(handleBlock.calledOnce).to.equal(true)
      expect(handleBlock.firstCall.args[0]).to.equal('0x2-hash')
    })

    it('should skip over blocks if another instance processes them', async function () {
      const db = withLastProcessedBlocksByCall([
        [{ hash: '1-hash', parent: '0-hash', height: 1 }],
        [{ hash: '1-hash', parent: '0-hash', height: 1 }],
        [{ hash: '4-hash', parent: '1-hash', height: 2 }],
      ])
      const node = withHappyChainNode()
      const handleBlock = sinon.stub().resolves({})

      indexer = new Indexer({ db, node, logger, handleBlock })
      await indexer.start()
      await indexer.processNextBlock('5-hash')
      const result = await indexer.processNextBlock('0x5-hash')

      expect(result).to.equal('0x5-hash')
      expect(handleBlock.calledTwice).to.equal(true)
      expect(handleBlock.firstCall.args[0]).to.equal('0x2-hash')
      expect(handleBlock.secondCall.args[0]).to.equal('0x5-hash')
    })

    it('should continue to process blocks if last finalised block goes backwards', async function () {
      const db = withInitialLastProcessedBlock({ hash: '1-hash', parent: '0-hash', height: 1 })
      const node = withHappyChainNode()
      const handleBlock = sinon.stub().resolves({})

      indexer = new Indexer({ db, node, logger, handleBlock })
      await indexer.start()
      await indexer.processNextBlock('3-hash')
      const result = await indexer.processNextBlock('2-hash')

      expect(result).to.equal('0x3-hash')
      expect(handleBlock.calledTwice).to.equal(true)
      expect(handleBlock.firstCall.args[0]).to.equal('0x2-hash')
      expect(handleBlock.secondCall.args[0]).to.equal('0x3-hash')
    })

    it('should upsert certificates and certificate entries from changeset', async function () {
      const db = withInitialLastProcessedBlock({ hash: '1-hash', parent: '0-hash', height: 1 })
      const node = withHappyChainNode()
      const handleBlock = sinon.stub().resolves({
        certificates: new Map([
          ['123', { type: 'update', id: '42' }],
          ['456', { type: 'update', id: '43' }],
        ]),
        attachments: new Map([
          ['111', { type: 'insert', id: '46' }],
          ['121', { type: 'insert', id: '47' }],
        ]),
      })

      indexer = new Indexer({ db, node, logger, handleBlock })
      await indexer.start()
      await indexer.processNextBlock('2-hash')

      expect((db.update as sinon.SinonStub).calledTwice).to.equal(true)
      expect((db.update as sinon.SinonStub).firstCall.args).to.deep.equal(['certificate', { id: '42' }, {}])
      expect((db.update as sinon.SinonStub).secondCall.args).to.deep.equal(['certificate', { id: '43' }, {}])

      expect((db.insert as sinon.SinonStub).calledThrice).to.equal(true)
      expect((db.insert as sinon.SinonStub).firstCall.args).to.deep.equal([
        'processed_blocks',
        { hash: '2-hash', height: 2, parent: '1-hash' },
      ])
      expect((db.insert as sinon.SinonStub).secondCall.args).to.deep.equal(['attachment', { id: '46' }])
      expect((db.insert as sinon.SinonStub).thirdCall.args).to.deep.equal(['attachment', { id: '47' }])
    })

    it('should insert attachments, certificates and certificate events entries from changeset', async function () {
      const db = withInitialLastProcessedBlock({ hash: '1-hash', parent: '0-hash', height: 1 })
      const node = withHappyChainNode()
      const handleBlock = sinon.stub().resolves({
        certificates: new Map([
          ['123', { type: 'insert', id: '42', mockData: 1 }],
          ['456', { type: 'insert', id: '43', mockData: 2 }],
        ]),
        attachments: new Map([
          ['111', { type: 'insert', id: '46', mockData: 3 }],
          ['121', { type: 'insert', id: '47', mockData: 4 }],
        ]),
        certificateEvents: new Map([
          ['111', { type: 'insert', mockData: 5 }],
          ['121', { type: 'insert', mockData: 6 }],
        ]),
      })

      indexer = new Indexer({ db, node, logger, handleBlock })
      await indexer.start()
      await indexer.processNextBlock('2-hash')

      expect((db.insert as sinon.SinonStub).getCalls().length).to.equal(7)
      expect((db.insert as sinon.SinonStub).getCall(0).args).to.deep.equal([
        'processed_blocks',
        { hash: '2-hash', height: 2, parent: '1-hash' },
      ])
      expect((db.insert as sinon.SinonStub).getCall(1).args).to.deep.equal(['attachment', { id: '46', mockData: 3 }])
      expect((db.insert as sinon.SinonStub).getCall(2).args).to.deep.equal(['attachment', { id: '47', mockData: 4 }])
      expect((db.insert as sinon.SinonStub).getCall(3).args).to.deep.equal(['certificate', { id: '42', mockData: 1 }])
      expect((db.insert as sinon.SinonStub).getCall(4).args).to.deep.equal(['certificate', { id: '43', mockData: 2 }])
      expect((db.insert as sinon.SinonStub).getCall(5).args).to.deep.equal(['certificate_event', { mockData: 5 }])
      expect((db.insert as sinon.SinonStub).getCall(6).args).to.deep.equal(['certificate_event', { mockData: 6 }])
    })

    describe('exception cases', function () {
      let clock: sinon.SinonFakeTimers
      beforeEach(function () {
        clock = sinon.useFakeTimers()
      })

      afterEach(function () {
        clock.restore()
      })

      it('should retry after configured delay', async function () {
        const db = withInitialLastProcessedBlock({ hash: '1-hash', parent: '0-hash', height: 1 })
        const node = withGetHeaderBoom(1)
        const handleBlock = sinon.stub().resolves({})

        indexer = new Indexer({ db, node, logger, handleBlock })
        await indexer.start()
        const p = indexer.processNextBlock('2-hash').then((s) => s)
        clock.tickAsync(1000)

        const result = await p

        expect(result).to.equal('0x2-hash')
        expect(handleBlock.calledOnce).to.equal(true)
        expect(handleBlock.firstCall.args[0]).to.equal('0x2-hash')
      })

      it('should retry if handler goes boom', async function () {
        const db = withInitialLastProcessedBlock({ hash: '1-hash', parent: '0-hash', height: 1 })
        const node = withHappyChainNode()
        const handleBlock = sinon.stub().resolves({}).onCall(0).rejects(new Error('BOOM'))

        indexer = new Indexer({ db, node, logger, handleBlock })
        await indexer.start()
        const p = indexer.processNextBlock('2-hash').then((s) => s)
        clock.tickAsync(1000)

        const result = await p

        expect(result).to.equal('0x2-hash')
        expect(handleBlock.calledTwice).to.equal(true)
        expect(handleBlock.secondCall.args[0]).to.equal('0x2-hash')
      })
    })
  })

  describe('processAllBlocks', function () {
    it('should process all pending blocks', async function () {
      const db = withInitialLastProcessedBlock({ hash: '1-hash', parent: '0-hash', height: 1 })
      const node = withHappyChainNode()
      const handleBlock = sinon.stub().resolves({})

      indexer = new Indexer({ db, node, logger, handleBlock })
      await indexer.start()
      const result = await indexer.processAllBlocks('3-hash')

      expect(result).to.equal('0x3-hash')
      expect(handleBlock.calledTwice).to.equal(true)
      expect(handleBlock.firstCall.args[0]).to.equal('0x2-hash')
      expect(handleBlock.secondCall.args[0]).to.equal('0x3-hash')
    })

    it('should return null if no blocks to process', async function () {
      const db = withInitialLastProcessedBlock({ hash: '1-hash', parent: '0-hash', height: 1 })
      const node = withHappyChainNode()
      const handleBlock = sinon.stub().resolves({})

      indexer = new Indexer({ db, node, logger, handleBlock })
      await indexer.start()
      const result = await indexer.processAllBlocks('0x1-hash')

      expect(result).to.equal(null)
      expect(handleBlock.called).to.equal(false)
    })
  })
})
