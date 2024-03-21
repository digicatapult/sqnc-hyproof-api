import { Logger } from 'pino'
import ChainNode, { ProcessRanEvent } from '../chainNode.js'
import Database from '../db/index.js'
import { ChangeSet, findLocalIdInChangeSet, mergeChangeSets } from './changeSet.js'
import defaultEventProcessors, { EventProcessors, ValidateProcessName } from './eventProcessor.js'

export interface EventHandlerCtorArgs {
  db: Database
  logger: Logger
  node: ChainNode
  eventProcessors?: EventProcessors
}

export default class EventHandler {
  private logger: Logger
  private db: Database
  private node: ChainNode
  private eventProcessors: EventProcessors

  constructor({ logger, db, node, eventProcessors }: EventHandlerCtorArgs) {
    this.logger = logger.child({ module: 'eventHandler' })
    this.db = db
    this.node = node
    this.eventProcessors = eventProcessors || defaultEventProcessors
  }

  public async handleEvent(event: ProcessRanEvent, currentChangeSet: ChangeSet) {
    this.logger.trace('Handling event %s:%d in call %s', event.process.id, event.process.version, event.callHash)

    // process changeset for event
    if (!ValidateProcessName(event.process.id)) {
      throw new Error(`Invalid process name ${event.process.id}`)
    }

    const [transaction] = await this.db.get('transaction', { hash: event.callHash })
    const inputs = await Promise.all(
      event.inputs.map(async (inputId) => {
        const localIdFromChangeset = findLocalIdInChangeSet(currentChangeSet, inputId)
        if (localIdFromChangeset) {
          return { id: inputId, local_id: localIdFromChangeset }
        }

        const [localIdFromDb] = await this.db.get('certificate', { latest_token_id: inputId })
        if (localIdFromDb) {
          return { id: inputId, local_id: localIdFromDb.id }
        }

        throw new Error(`Unknown token with id ${inputId}`)
      })
    )

    const eventChangeSet = this.eventProcessors[event.process.id]({
      version: event.process.version,
      blockTime: event.blockTime,
      transaction,
      sender: event.sender,
      inputs,
      outputs: await Promise.all(event.outputs.map(async (id: number) => this.node.getToken(id, event.blockHash))),
    })

    // merge currentChangeSet with eventChangeSet
    return mergeChangeSets(currentChangeSet, eventChangeSet)
  }
}
