import 'reflect-metadata'

import { Express } from 'express'
import { container } from 'tsyringe'

import Indexer from './lib/indexer/index.js'
import ChainNode from './lib/chainNode.js'
import Database from './lib/db/index.js'
import Server from './server.js'
import { Env } from './env.js'

import { logger } from './lib/logger.js'
;(async () => {
  const app: Express = await Server()
  const env = container.resolve(Env)

  if (env.get('ENABLE_INDEXER')) {
    const node = container.resolve(ChainNode)

    const indexer = new Indexer({ db: new Database(), logger, node })
    await indexer.start()
    indexer.processAllBlocks(await node.getLastFinalisedBlockHash()).then(() =>
      node.watchFinalisedBlocks(async (hash) => {
        await indexer.processAllBlocks(hash)
      })
    )
  }

  app.listen(env.get('PORT'), () => {
    logger.info(`sqnc-hyproof-api listening on ${env.get('PORT')} port`)
  })
})()
