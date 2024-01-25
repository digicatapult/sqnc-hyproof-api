import { Knex } from 'knex'
import { z } from 'zod'

export const tablesList = ['attachment', 'certificate', 'transaction', 'processed_blocks'] as const

const insertAttachment = z.object({
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

const insertTransaction = z.object({
  api_type: z.union([z.literal('certificate'), z.literal('example_a'), z.literal('example_b')]),
  transaction_type: z.union([z.literal('initiate_cert'), z.literal('issue_cert'), z.literal('revoke_cert')]),
  local_id: z.string(),
  hash: z.string(),
  state: z
    .union([z.literal('submitted'), z.literal('inBlock'), z.literal('finalised'), z.literal('failed')])
    .optional(),
})

const insertBlock = z.object({
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

const insertCertificate = z.object({
  hydrogen_owner: z.string(),
  energy_owner: z.string(),
  regulator: z.string(),
  hydrogen_quantity_wh: z.string(),
  original_token_id: z.union([z.number(), z.null()]),
  latest_token_id: z.union([z.number(), z.null()]),
  commitment: z.string(),
  commitment_salt: z.union([z.string(), z.null()]),
  production_start_time: z.union([z.date(), z.null()]),
  production_end_time: z.union([z.date(), z.null()]),
  energy_consumed_wh: z.union([z.string(), z.null()]),
})

const Zod = {
  attachment: {
    insert: insertAttachment,
    get: insertAttachment.extend({
      id: z.string(),
      created_at: z.date(),
    }),
  },
  processed_blocks: {
    insert: insertBlock,
    get: insertBlock.extend({
      created_at: z.date(),
    }),
  },
  transaction: {
    insert: insertTransaction,
    get: insertTransaction.extend({
      id: z.string(),
      state: z.union([z.literal('submitted'), z.literal('inBlock'), z.literal('finalised'), z.literal('failed')]),
      created_at: z.date(),
      updated_at: z.date(),
    }),
  },
  certificate: {
    insert: insertCertificate,
    get: insertCertificate.extend({
      id: z.string(),
      state: z.union([z.literal('pending'), z.literal('initiated'), z.literal('issued'), z.literal('revoked')]),
      created_at: z.date(),
      updated_at: z.date(),
      embodied_co2: z.union([z.string(), z.null()]),
      revocation_reason: z.union([z.string(), z.null()]),
    }),
  },
}

const { transaction, attachment, processed_blocks, certificate } = Zod

export type InsertTransaction = z.infer<typeof transaction.insert>
export type TransactionRow = z.infer<typeof transaction.get>

export type InsertCertificateRow = z.infer<typeof certificate.insert>
export type CertificateRow = z.infer<typeof certificate.get>

export type InsertProcessedBlockRow = z.infer<typeof processed_blocks.insert>
export type ProcessedBlockRow = z.infer<typeof processed_blocks.get>

export type InsertAttachmentRow = z.infer<typeof attachment.insert>
export type AttachmentRow = z.infer<typeof attachment.get>

export type TABLES_TUPLE = typeof tablesList
export type TABLE = TABLES_TUPLE[number]
export type Models = {
  [key in TABLE]: {
    get: z.infer<(typeof Zod)[key]['get']>
    insert: z.infer<(typeof Zod)[key]['insert']>
  }
}

type WhereComparison<M extends TABLE> = {
  [key in keyof Models[M]['get']]: [
    Extract<key, string>,
    '=' | '>' | '>=' | '<' | '<=' | '<>',
    Extract<Models[M]['get'][key], Knex.Value>,
  ]
}
type WhereMatch<M extends TABLE> = {
  [key in keyof Models[M]['get']]?: Models[M]['get'][key]
}

export type Where<M extends TABLE> = WhereMatch<M> | (WhereMatch<M> | WhereComparison<M>[keyof Models[M]['get']])[]
export type Order<M extends TABLE> = [keyof Models[M]['get'], 'asc' | 'desc'][]
export type Update<M extends TABLE> = Partial<Models[M]['get']>
export type IDatabase = {
  [key in TABLE]: () => Knex.QueryBuilder
}

export default Zod
