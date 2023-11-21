import { Express } from 'express'

import Indexer from './lib/indexer'
import ChainNode from './lib/chainNode'
import Database from './lib/db'
import Server from './server'
import env from './env'
import { logger } from './lib/logger'
;(async () => {
  const app: Express = await Server()

  if (env.ENABLE_INDEXER) {
    const node = new ChainNode({
      host: env.NODE_HOST,
      port: env.NODE_PORT,
      logger,
      userUri: env.USER_URI,
    })

    const indexer = new Indexer({ db: new Database(), logger, node })
    await indexer.start()
    indexer.processAllBlocks(await node.getLastFinalisedBlockHash()).then(() =>
      node.watchFinalisedBlocks(async (hash) => {
        await indexer.processAllBlocks(hash)
      })
    )
  }

  app.listen(env.PORT, () => {
    logger.info(`dscp-hyproof-api listening on ${env.PORT} port`)
  })
})()
