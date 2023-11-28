import { Logger } from 'pino'
import ChainNode, { ProcessRanEvent } from '../chainNode'
import Database, { TransactionRow } from '../db'
import { ChangeSet, findLocalIdInChangeSet, mergeChangeSets } from './changeSet'
import defaultEventProcessors, { EventProcessors, ValidateProcessName } from './eventProcessor'

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

    // lookup transaction from call hash in db
    const [transaction]: TransactionRow[] = await this.db.get('transaction', { hash: event.callHash })

    // lookup inputs from db and merge with changeset
    const inputs = await Promise.all(
      event.inputs.map(async (inputId) => {
        const localIdFromChangeset = findLocalIdInChangeSet(currentChangeSet, inputId)
        if (localIdFromChangeset) {
          return { id: inputId, localId: localIdFromChangeset }
        }

        const localIdFromDb = await this.db.findLocalIdForToken(inputId)
        if (localIdFromDb) {
          return { id: inputId, localId: localIdFromDb }
        }

        throw new Error(`Unknown token with id ${inputId}`)
      })
    )

    // get output tokens from node
    const outputs = await Promise.all(event.outputs.map(async (id: number) => this.node.getToken(id, event.blockHash)))

    const eventChangeSet = this.eventProcessors[event.process.id](
      event.process.version,
      transaction,
      event.sender,
      inputs,
      outputs
    )

    // merge currentChangeSet with eventChangeSet
    const changeSet = mergeChangeSets(currentChangeSet, eventChangeSet)

    return changeSet
  }
}
