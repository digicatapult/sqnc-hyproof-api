import knex, { Knex } from 'knex'

import { pgConfig } from './knexfile'
import { DATE, HEX, UUID } from '../../models/strings'
import { TransactionApiType, TransactionState, TransactionType } from '../../models/transaction'
import { NotFound } from '../error-handler'

const tablesList = ['attachment', 'certificate', 'transaction', 'processed_blocks'] as const
type TABLES_TUPLE = typeof tablesList
type TABLE = TABLES_TUPLE[number]

export type Models<V> = {
  [key in TABLE]: V
}
export type QueryBuilder = Knex.QueryBuilder
export type ProcessedBlock = { hash: HEX; parent: HEX; height: number }
export type ProcessedBlockTrimmed = { hash: string; parent: string; height: number }

export interface AttachmentRow {
  id: UUID
  filename: string | null
  size: number | null
  ipfs_hash: string
  created_at: DATE
}

export interface TransactionRow {
  id: UUID
  state: TransactionState
  local_id: UUID
  apiType: TransactionApiType
  transaction_type: TransactionType
  submitted_at: Date
  updated_at: Date
}

export interface CertificateRow {
  id: UUID
  state: 'initialise' | 'issue' | 'revoke'
  created_at: Date
  updated_at: Date
  hydrogen_owner: string
  energy_owner: string
  embodied_co2?: number | null
  hydrogen_quantity_mwh: number
}

export type Entity = CertificateRow & TransactionRow & AttachmentRow

function restore0x(input: ProcessedBlockTrimmed): ProcessedBlock {
  return {
    hash: input.hash.startsWith('0x') ? (input.hash as HEX) : `0x${input.hash}`,
    height: input.height,
    parent: input.parent.startsWith('0x') ? (input.parent as HEX) : `0x${input.parent}`,
  }
}

function trim0x(input: ProcessedBlock): ProcessedBlockTrimmed {
  return {
    hash: input.hash.startsWith('0x') ? input.hash.slice(2) : input.hash,
    height: input.height,
    parent: input.parent.startsWith('0x') ? input.parent.slice(2) : input.parent,
  }
}

const clientSingleton: Knex = knex(pgConfig)

export default class Database {
  public db: () => Models<() => QueryBuilder>

  constructor(private client: Knex = clientSingleton) {
    const models = tablesList.reduce((acc, name) => {
      return {
        [name]: () => client(name),
        ...acc,
      }
    }, {}) as Models<() => QueryBuilder>
    this.db = () => models
  }

  // generics methods
  insert = async (
    model: keyof Models<() => QueryBuilder>,
    record: Record<string, string | number | UUID>
  ): Promise<Entity> => {
    const query = this.db()[model]

    // TODO address indexer (create a backlog item)
    if (model == 'processed_blocks') {
      return query().insert(trim0x(record as ProcessedBlock))
    }

    return query().insert(record).returning('id')
  }

  delete = async (model: keyof Models<() => QueryBuilder>, where: Record<string, string | number>) => {
    return this.db()
      [model]()
      .where(where || {})
      .delete()
  }

  update = async (
    model: keyof Models<() => QueryBuilder>,
    where: { [k: string]: string | number | UUID },
    updates: Record<string, string | number>
  ): Promise<Record<string, string>[]> => {
    const query = this.db()[model]
    console.log({ model, where, updates })
    return query()
      .update({
        ...updates,
        updated_at: this.client.fn.now(),
      })
      .where(where)
      .returning('*')
  }

  get = async (model: keyof Models<() => QueryBuilder>, where: Record<string, string | number | Date> = {}) => {
    const query = this.db()[model]
    const result = (await query().where(where)) as unknown as Entity[]

    if (result.length === 0) throw new NotFound(model)

    return result
  }

  // TODO some methods could be generic as well, e.g. insert/get for event processor indexer
  findLocalIdForToken = async (tokenId: number): Promise<UUID | null> => {
    const result = (await Promise.all([
      this.db().certificate().select(['id']).where({ latest_token_id: tokenId }),
    ])) as { id: UUID }[][]
    const flatten = result.reduce((acc, set) => [...acc, ...set], [])
    return flatten[0]?.id || null
  }

  getLastProcessedBlock = async (): Promise<ProcessedBlock | null> => {
    return this.db()
      .processed_blocks()
      .orderBy('height', 'desc')
      .limit(1)
      .then((blocks) => (blocks.length !== 0 ? restore0x(blocks[0]) : null))
  }

  insertProcessedBlock = async (block: ProcessedBlock): Promise<void> => {
    await this.db().processed_blocks().insert(trim0x(block))
  }

  withTransaction = (update: (db: Database) => Promise<void>) => {
    return this.client.transaction(async (trx) => {
      const decorated = new Database(trx)
      await update(decorated)
    })
  }
}
