// eslint-disable-next-line @typescript-eslint/no-unused-vars

import { Logger } from 'pino'
import Database from '../db'
import ChainNode from '../chainNode'

import { ChangeSet } from './changeSet'
import EventHandler from './handleEvent'
import { HEX } from '../../models/strings'

export interface BlockHandlerCtorArgs {
  db: Database
  logger: Logger
  node: ChainNode
  eventHandler?: EventHandler
}

export default class BlockHandler {
  private logger: Logger
  private node: ChainNode
  private eventHandler: EventHandler

  constructor({ db, logger, node, eventHandler }: BlockHandlerCtorArgs) {
    this.logger = logger.child({ module: 'blockHandler' })
    this.node = node
    this.eventHandler = eventHandler || new EventHandler({ logger, db, node })
  }

  public async handleBlock(blockHash: HEX): Promise<ChangeSet> {
    this.logger.debug('Getting events for block %s', blockHash)
    // find ProcessRan events events
    const events = await this.node.getProcessRanEvents(blockHash)

    // loop over events and handle
    const changeSet = await events.reduce(async (accP: Promise<ChangeSet>, event) => {
      this.logger.debug('ProcessRan event from call %s', event.callHash)
      this.logger.trace('ProcessRan event from call %s details: %j', event.callHash, event)
      const acc = await accP
      return await this.eventHandler.handleEvent(event, acc)
    }, Promise.resolve({}))

    return changeSet
  }
}
