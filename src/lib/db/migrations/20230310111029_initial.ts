import { Knex } from 'knex'

// TODO we shoyuld yse createSchema....
export async function up(knex: Knex): Promise<void> {
  const [extInstalled] = await knex('pg_extension').select('*').where({ extname: 'uuid-ossp' })

  if (!extInstalled) await knex.raw('CREATE EXTENSION "uuid-ossp"')
  const now = () => knex.fn.now()

  await knex.schema.createTable('attachment', (def) => {
    def.uuid('id').defaultTo(knex.raw('uuid_generate_v4()'))
    def.string('filename', 255).nullable().defaultTo(null)
    def.string('ipfs_hash', 255).notNullable()
    def.bigInteger('size').nullable().defaultTo(null)
    def.binary('binary_blob').nullable().defaultTo(null)
    def.datetime('created_at').notNullable().defaultTo(knex.fn.now())

    def.primary(['id'])
  })

  await knex.schema.createTable('certificate', (def) => {
    def.uuid('id').defaultTo(knex.raw('uuid_generate_v4()'))
    def.integer('capacity').notNullable().index('capacity_index')
    def.integer('co2e').notNullable().index('co2e_index')
    def.string('owner', 48).notNullable()
    def
      .enum('state', ['initialized', 'issued', 'revoked'], {
        enumName: 'certificate_state',
        useNative: true,
      })
      .notNullable()
      .defaultTo('initialized')
    def.integer('latest_token_id').defaultTo(null)
    def.integer('original_token_id').defaultTo(null)
    def.datetime('created_at').notNullable().defaultTo(now())
    def.datetime('updated_at').notNullable().defaultTo(now())
    def.primary(['id'])
  })

  await knex.schema.createTable('processed_blocks', (def) => {
    def.specificType('hash', 'CHAR(64)').notNullable()
    def.bigInteger('height').unsigned().notNullable().unique()
    def.specificType('parent', 'CHAR(64)').notNullable()
    def.datetime('created_at').notNullable().defaultTo(knex.fn.now())

    def.primary(['hash'])
  })

  await knex.schema.alterTable('processed_blocks', (def) => {
    def.foreign('parent', 'fk_processed_blocks_parent_hash').references('hash').inTable('processed_blocks')
  })
  await knex.schema.createTable('transaction', (def) => {
    def.uuid('id').defaultTo(knex.raw('uuid_generate_v4()'))
    def.uuid('local_id').notNullable()
    def
      .enum('state', ['submitted', 'inBlock', 'finalised', 'failed'], {
        enumName: 'transaction_state',
        useNative: true,
      })
      .notNullable()
      .defaultTo('submitted')
    def.datetime('created_at').notNullable().defaultTo(now())
    def.datetime('updated_at').notNullable().defaultTo(now())
    def.integer('token_id')
    def.primary(['id'])
    def.specificType('hash', 'CHAR(64)').notNullable()
    def.enu('api_type', ['certificate'], { useNative: true, enumName: 'api_type' }).notNullable()
    def
      .enu('transaction_type', ['initialise', 'issue', 'revoke'], { useNative: true, enumName: 'transaction_type' })
      .defaultTo('initialise')
    def.unique(['id', 'local_id'], { indexName: 'transaction-id-local-id' })
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('attachment')
  await knex.schema.dropTable('certificate')
  await knex.schema.dropTable('transaction')
  await knex.schema.dropTable('processed_blocks')
  await knex.raw('DROP EXTENSION "uuid-ossp"')
}
