import knex, { Knex } from 'knex'

import { pgConfig } from './knexfile'
import { z } from 'zod'
import { singleton } from 'tsyringe'

const tablesList = ['attachment', 'certificate', 'transaction', 'processed_blocks'] as const
type TABLES_TUPLE = typeof tablesList
type TABLE = TABLES_TUPLE[number]

type IDB = {
  [key in TABLE]: () => Knex.QueryBuilder
}

const insertAttachmentRowZ = z.object({
  filename: z
    .union([z.string(), z.null()])
    .optional()
    .transform((filename) => filename || null),
  size: z
    .union([z.string(), z.null()])
    .optional()
    .transform((size) => {
      if (!size) return null
      const asInt = parseInt(size)
      if (!Number.isSafeInteger(asInt) || asInt < 0) {
        throw new Error('Size must be an integer > 0')
      }
      return asInt
    }),
  ipfs_hash: z.string(),
})

const attachmentRowZ = insertAttachmentRowZ.extend({
  id: z.string(),
  created_at: z.date(),
})

export type InsertAttachmentRow = z.infer<typeof insertAttachmentRowZ>
export type AttachmentRow = z.infer<typeof attachmentRowZ>

const insertTransactionRowZ = z.object({
  api_type: z.union([z.literal('certificate'), z.literal('example_a'), z.literal('example_b')]),
  local_id: z.string(),
  hash: z.string(),
  state: z
    .union([z.literal('submitted'), z.literal('inBlock'), z.literal('finalised'), z.literal('failed')])
    .optional(),
})

const transactionRowZ = insertTransactionRowZ.extend({
  id: z.string(),
  state: z.union([z.literal('submitted'), z.literal('inBlock'), z.literal('finalised'), z.literal('failed')]),
  created_at: z.date(),
  updated_at: z.date(),
})

export type InsertTransactionRow = z.infer<typeof insertTransactionRowZ>
export type TransactionRow = z.infer<typeof transactionRowZ>

const insertCertificateRowZ = z.object({
  hydrogen_owner: z.string(),
  energy_owner: z.string(),
  hydrogen_quantity_mwh: z.number(),
  original_token_id: z.union([z.number(), z.null()]),
  latest_token_id: z.union([z.number(), z.null()]),
})

const certificateRowZ = insertCertificateRowZ.extend({
  id: z.string(),
  state: z.union([z.literal('pending'), z.literal('initiated'), z.literal('issued'), z.literal('revoked')]),
  created_at: z.date(),
  updated_at: z.date(),
  embodied_co2: z.union([z.number(), z.null()]),
})

export type InsertCertificateRow = z.infer<typeof insertCertificateRowZ>
export type CertificateRow = z.infer<typeof certificateRowZ>

const insertProcessedBlockRowZ = z.object({
  hash: z.string().regex(/^[0-9a-z]{64}$/),
  parent: z.string().regex(/^[0-9a-z]{64}$/),
  height: z.string().transform((height) => {
    const asInt = parseInt(height)
    if (!Number.isSafeInteger(asInt) || asInt < 0) {
      throw new Error('Height cannot be less than zero')
    }
    return asInt
  }),
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

type WhereComparison<M extends TABLE> = {
  [key in keyof TestModels[M]['get']]: [
    Extract<key, string>,
    '=' | '>' | '>=' | '<' | '<=' | '<>',
    Extract<TestModels[M]['get'][key], Knex.Value>,
  ]
}
type WhereMatch<M extends TABLE> = {
  [key in keyof TestModels[M]['get']]?: TestModels[M]['get'][key]
}

export type Where<M extends TABLE> = WhereMatch<M> | (WhereMatch<M> | WhereComparison<M>[keyof TestModels[M]['get']])[]

export type Order<M extends TABLE> = [keyof TestModels[M]['get'], 'asc' | 'desc'][]
export type Update<M extends TABLE> = Partial<TestModels[M]['get']>

const clientSingleton = knex(pgConfig)
@singleton()
export default class Database {
  private db: IDB

  constructor(private client = clientSingleton) {
    this.client = client
    const models: IDB = tablesList.reduce((acc, name) => {
      return {
        [name]: () => clientSingleton(name),
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
    if (where) {
      if (!Array.isArray(where)) {
        where = [where]
      }
      query = where.reduce((acc, w) => (Array.isArray(w) ? acc.where(w[0], w[1], w[2]) : acc.where(w)), query)
    }
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
