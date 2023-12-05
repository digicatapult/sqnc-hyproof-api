import { Logger } from 'pino'

import type Database from '../db/index'
import ChainNode from '../chainNode'

import DefaultBlockHandler from './handleBlock'
import { ChangeSet } from './changeSet'
import { HEX } from '../../models/strings'
import { restore0x, trim0x } from '../utils/shared'

export type BlockHandler = (blockHash: HEX) => Promise<ChangeSet>

export interface IndexerCtorArgs {
  db: Database
  logger: Logger
  node: ChainNode
  handleBlock?: BlockHandler
  retryDelay?: number
}

export default class Indexer {
  private logger: Logger
  private db: Database
  private node: ChainNode
  private gen: AsyncGenerator<HEX | null, void, string>
  private handleBlock: BlockHandler
  private unprocessedBlocks: HEX[]
  private retryDelay: number

  constructor({ db, logger, node, handleBlock, retryDelay }: IndexerCtorArgs) {
    this.logger = logger.child({ module: 'indexer' })
    this.db = db
    this.node = node
    this.gen = this.nextBlockProcessor()
    this.unprocessedBlocks = []
    this.retryDelay = retryDelay || 1000
    if (handleBlock) {
      this.handleBlock = handleBlock
      return
    }
    const blockHandler = new DefaultBlockHandler({ db, node, logger: this.logger })
    this.handleBlock = blockHandler.handleBlock.bind(blockHandler)
  }

  public async start() {
    this.logger.info('Starting Block Indexer')

    // get the latest finalised hash
    const latestFinalisedHash = await this.node.getLastFinalisedBlockHash()
    // update the internal generator state and wait for that to finish
    const lastProcessedHash = await this.processNextBlock(latestFinalisedHash)

    // this.state = 'started'
    this.logger.info('Block Indexer Started')

    return lastProcessedHash
  }

  public async close() {
    this.logger.info('Closing Block Indexer')
    await this.gen.return()
    // this.state = 'stopped'
    this.logger.info('Block Indexer Closed')
  }

  public async processAllBlocks(latestFinalisedHash: string): Promise<HEX | null> {
    let done = false
    let lastBlockProcessed: HEX | null = null
    do {
      const result = await this.gen.next(restore0x(latestFinalisedHash))
      if (result.value !== null && result.value) {
        lastBlockProcessed = result.value
      }
      done = result.done || result.value === null
    } while (!done)

    return lastBlockProcessed
  }

  public async processNextBlock(latestFinalisedHash: string): Promise<HEX | null> {
    const result = await this.gen.next(restore0x(latestFinalisedHash))
    return result.value || null
  }

  // async generator that gets the next finalised block and processes it with the provided handler
  // takes the last processed block hash
  // yields the hash of the processed block
  // main benefit of using a generator is it funnels all triggers from any source into a single
  // serialised async flow
  private async *nextBlockProcessor(): AsyncGenerator<HEX | null, void, HEX> {
    const lastProcessedBlock = await this.getLastProcessedBlock()
    this.unprocessedBlocks = [lastProcessedBlock?.hash].filter((x): x is HEX => !!x)

    const loopFn = async (lastKnownFinalised: HEX): Promise<void> => {
      try {
        const lastProcessedBlock = await this.getLastProcessedBlock()
        this.logger.debug('Last processed block: %s', lastProcessedBlock?.hash)

        await this.updateUnprocessedBlocks(lastProcessedBlock?.hash || null, lastKnownFinalised)

        if (this.unprocessedBlocks.length !== 0) {
          const changeSet = await this.handleBlock(this.unprocessedBlocks[0])
          await this.updateDbWithNewBlock(this.unprocessedBlocks[0], changeSet)
        }
      } catch (err) {
        const asError = err as Error | null
        this.logger.warn('Unexpected error indexing blocks. Error was %s. Retrying...', asError?.message)
        return new Promise((r) => {
          setTimeout(() => {
            loopFn(lastKnownFinalised).then(r)
          }, this.retryDelay)
        })
      }
    }

    while (true) {
      const lastKnownFinalised = yield this.unprocessedBlocks.shift() || null
      await loopFn(lastKnownFinalised)
    }
  }

  private async getLastProcessedBlock() {
    const [lastProcessedBlock] = await this.db.get('processed_blocks', {}, [['height', 'desc']], 1)
    if (!lastProcessedBlock) {
      return undefined
    }
    return {
      ...lastProcessedBlock,
      hash: restore0x(lastProcessedBlock.hash),
      parent: restore0x(lastProcessedBlock.parent),
    }
  }

  private async updateUnprocessedBlocks(lastProcessedHash: HEX | null, lastFinalisedHash: HEX): Promise<void> {
    this.logger.debug('Updating list of finalised blocks to be processed')

    const unprocessedBlocks = [...this.unprocessedBlocks]

    // remove elements up to and including out lastProcessedHash if it's in the unprocessedBlocks array
    // this can happen if another instance is also processing blocks
    if (lastProcessedHash !== null) {
      const lastProcessedHashIndex = unprocessedBlocks.indexOf(lastProcessedHash)
      if (lastProcessedHashIndex !== -1) {
        unprocessedBlocks.splice(0, lastProcessedHashIndex + 1)
      }

      if (unprocessedBlocks.length !== 0) {
        const nextHeader = await this.node.getHeader(unprocessedBlocks[0])
        if (lastProcessedHash !== nextHeader.parent) {
          unprocessedBlocks.splice(0, unprocessedBlocks.length)
        }
      }
    }

    // find the earliest hash we know about. This is either the last process hash or the last element in the unprocessedBlocks array
    // if we have lots of blocks to process still
    const lastKnownHash = unprocessedBlocks.at(-1) || lastProcessedHash
    const [{ height: lastKnownIndex }, { height: lastFinalisedIndex }] = await Promise.all([
      lastKnownHash !== null ? this.node.getHeader(lastKnownHash) : Promise.resolve({ height: 0 }),
      this.node.getHeader(lastFinalisedHash),
    ])

    // if we know about all the blocks then noop
    // note we allow the finalised block to go backwards so if the node we're talking to isn't up to date
    // things still proceed
    if (lastFinalisedIndex <= lastKnownIndex) {
      this.unprocessedBlocks = unprocessedBlocks
      return
    }

    // get the new hashes based on the difference in block height
    const newHashes = [lastFinalisedHash]
    for (let i = lastFinalisedIndex; i > lastKnownIndex + 1; i--) {
      const lastChild = await this.node.getHeader(newHashes.at(-1) as HEX)
      newHashes.push(lastChild.parent)
    }

    // sanity check that the parent of lastKnown index is indeed what we expect. If not we have a major problem
    if (lastKnownHash !== null && (await this.node.getHeader(newHashes.at(-1) as HEX)).parent !== lastKnownHash) {
      this.unprocessedBlocks = []
      throw new Error('Unexpected error synchronising blocks to be processed')
    }

    this.unprocessedBlocks = unprocessedBlocks.concat(newHashes.reverse())

    this.logger.debug(`Found ${this.unprocessedBlocks.length} blocks to be processed`)
    this.logger.trace('Blocks to be processed: %j', this.unprocessedBlocks)
  }

  private async updateDbWithNewBlock(blockHash: HEX, changeSet: ChangeSet): Promise<void> {
    this.logger.debug('Inserting changeset %j for block %s', changeSet, blockHash)
    const header = await this.node.getHeader(blockHash)
    await this.db.withTransaction(async (db) => {
      if (header.height === 1) {
        await db.insert('processed_blocks', {
          hash: trim0x(header.parent),
          height: 0,
          parent: trim0x(header.parent),
        })
      }
      await db.insert('processed_blocks', {
        hash: trim0x(header.hash),
        height: header.height,
        parent: trim0x(header.parent),
      })

      if (changeSet.attachments) {
        for (const [, example] of changeSet.attachments) {
          const { type, ...record } = example
          switch (type) {
            case 'insert':
              await db.insert('attachment', record)
              break
          }
        }
      }

      // INFO we can do no if and just pass entity as arg?
      if (changeSet.certificates) {
        for (const [, certificate] of changeSet.certificates) {
          switch (certificate.type) {
            case 'insert': {
              const { type, id, ...record } = certificate
              await db.insert('certificate', record)
              break
            }
            case 'update': {
              const { type, id, ...record } = certificate
              await db.update('certificate', { id: id }, record)
              break
            }
          }
        }
      }
    })
  }
}
