import knex, { Knex } from 'knex'

import { pgConfig } from './knexfile'
import { z } from 'zod'

const clientSingleton: Knex = knex(pgConfig)
const tablesList = ['attachment', 'certificate', 'transaction', 'processed_blocks'] as const
type TABLES_TUPLE = typeof tablesList
type TABLE = TABLES_TUPLE[number]

type IDB = {
  [key in TABLE]: () => Knex.QueryBuilder
}

const insertAttachmentRowZ = z.object({
  filename: z.string().optional(),
  size: z.number().optional(),
  ipfs_hash: z.string(),
})

const attachmentRowZ = insertAttachmentRowZ.extend({
  id: z.string(),
})

export type InsertAttachmentRow = z.infer<typeof insertAttachmentRowZ>
export type AttachmentRow = z.infer<typeof attachmentRowZ>

const insertTransactionRowZ = z.object({
  api_type: z.union([z.literal('certificate'), z.literal('example_a'), z.literal('example_b')]),
  local_id: z.string(),
  hash: z.string(),
})

const transactionRowZ = insertTransactionRowZ.extend({
  id: z.string(),
  state: z.union([z.literal('submitted'), z.literal('inBlock'), z.literal('finalised'), z.literal('failed')]),
  submitted_at: z.date(),
  updated_at: z.date(),
})

export type InsertTransactionRow = z.infer<typeof insertTransactionRowZ>
export type TransactionRow = z.infer<typeof transactionRowZ>

const insertCertificateRowZ = z.object({
  hydrogen_owner: z.string(),
  energy_owner: z.string(),
  hydrogen_quantity_mwh: z.number(),
  original_token_id: z.number().optional(),
  latest_token_id: z.number().optional(),
})

const certificateRowZ = insertCertificateRowZ.extend({
  id: z.string(),
  state: z.union([z.literal('pending'), z.literal('initiated'), z.literal('issued'), z.literal('revoked')]),
  created_at: z.date(),
  updated_at: z.date(),
  embodied_co2: z.number().optional(),
})

export type InsertCertificateRow = z.infer<typeof insertCertificateRowZ>
export type CertificateRow = z.infer<typeof certificateRowZ>

const insertProcessedBlockRowZ = z.object({
  hash: z.string().regex(/^[0-9a-z]{64}$/),
  parent: z.string().regex(/^[0-9a-z]{64}$/),
  height: z.number().int().min(0),
})

const processedBlockRowZ = insertProcessedBlockRowZ.extend({
  created_at: z.date(),
})

export type InsertProcessedBlockRow = z.infer<typeof insertProcessedBlockRowZ>
export type ProcessedBlockRow = z.infer<typeof processedBlockRowZ>

const TestModelsValidation = {
  attachment: {
    insert: insertAttachmentRowZ,
    get: attachmentRowZ,
  },
  certificate: {
    insert: insertCertificateRowZ,
    get: certificateRowZ,
  },
  transaction: {
    insert: insertTransactionRowZ,
    get: transactionRowZ,
  },
  processed_blocks: {
    insert: insertProcessedBlockRowZ,
    get: processedBlockRowZ,
  },
}
export type TestModels = {
  [key in TABLE]: {
    get: z.infer<(typeof TestModelsValidation)[key]['get']>
    insert: z.infer<(typeof TestModelsValidation)[key]['insert']>
  }
}
export type TestTable = keyof TestModels

export type Where<M extends TABLE> = {
  [key in keyof TestModels[M]['get']]?:
    | TestModels[M]['get'][key]
    | { op: '=' | '>' | '>=' | '<' | '<=' | '<>'; value: TestModels[M]['get'][key] }
}

export type Order<M extends TABLE> = [keyof TestModels[M]['get'], 'asc' | 'desc'][]
export type Update<M extends TABLE> = Partial<TestModels[M]['get']>

export default class Database {
  private db: IDB
  constructor(private client: Knex = clientSingleton) {
    const models: IDB = tablesList.reduce((acc, name) => {
      return {
        [name]: () => client(name),
        ...acc,
      }
    }, {}) as IDB
    this.db = models
  }

  // backlog item for if statement model === logic has been added and returns etc
  insert = async <M extends TestTable>(
    model: M,
    record: TestModels[typeof model]['insert']
  ): Promise<TestModels[typeof model]['get'][]> => {
    return z.array(TestModelsValidation[model].get).parse(await this.db[model]().insert(record).returning('*'))
  }

  delete = async <M extends TestTable>(model: M, where: Where<M>): Promise<void> => {
    return this.db[model]()
      .where(where || {})
      .delete()
  }

  update = async <M extends TestTable>(
    model: M,
    where: Where<M>,
    updates: Update<M>
  ): Promise<TestModels[typeof model]['get'][]> => {
    return z.array(TestModelsValidation[model].get).parse(
      await this.db[model]()
        .update({
          ...updates,
          updated_at: this.client.fn.now(),
        })
        .where(where)
        .returning('*')
    )
  }

  get = async <M extends TestTable>(
    model: M,
    where?: Where<M>,
    order?: Order<M>,
    limit?: number
  ): Promise<TestModels[typeof model]['get'][]> => {
    let query = this.db[model]()
    if (where) query = query.where(where)
    if (order && order.length !== 0) {
      query = order.reduce((acc, [key, direction]) => acc.orderBy(key, direction), query)
    }
    if (limit !== undefined) query = query.limit(limit)
    const result = await query
    return z.array(TestModelsValidation[model].get).parse(result)
  }

  withTransaction = (update: (db: Database) => Promise<void>) => {
    return this.client.transaction(async (trx) => {
      const decorated = new Database(trx)
      await update(decorated)
    })
  }
}
