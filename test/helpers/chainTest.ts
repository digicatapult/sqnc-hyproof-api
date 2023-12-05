import { before, after } from 'mocha'
import { Express } from 'express'

import createHttpServer from '../../src/server'
import Indexer from '../../src/lib/indexer'

import Database from '../../src/lib/db'
import ChainNode from '../../src/lib/chainNode'
import { logger } from '../../src/lib/logger'

const db = new Database()

export const withAppAndIndexer = (context: { app: Express; indexer: Indexer }) => {
  before(async function () {
    context.app = await createHttpServer()
    const node = new ChainNode()

    const blockHash = await node.getLastFinalisedBlockHash()
    const blockHeader = await node.getHeader(blockHash)
    await db
      .insert('processed_blocks', {
        hash: blockHash,
        height: blockHeader.height,
        parent: blockHash,
      })
      .catch(() => {
        // intentional ignorance of errors
      })

    context.indexer = new Indexer({ db: new Database(), logger, node })
    await context.indexer.start()
    context.indexer.processAllBlocks(await node.getLastFinalisedBlockHash()).then(() =>
      node.watchFinalisedBlocks(async (hash) => {
        await context.indexer.processAllBlocks(hash)
      })
    )
  })

  after(async function () {
    await context.indexer.close()
  })
}
