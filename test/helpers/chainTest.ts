import { before, after } from 'mocha'
import { Express } from 'express'

import createHttpServer from '../../src/server'
import Indexer from '../../src/lib/indexer'

import Database from '../../src/lib/db'
import ChainNode from '../../src/lib/chainNode'
import { logger } from '../../src/lib/logger'
import env from '../../src/env'

const db = new Database()

export const withAppAndIndexer = (context: { app: Express; indexer: Indexer }) => {
  before(async function () {
    context.app = await createHttpServer()
    const node = new ChainNode({
      host: env.NODE_HOST,
      port: env.NODE_PORT,
      logger,
      userUri: env.USER_URI,
    })

    const blockHash = await node.getLastFinalisedBlockHash()
    const blockHeader = await node.getHeader(blockHash)
    await db
      .insertProcessedBlock({
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
