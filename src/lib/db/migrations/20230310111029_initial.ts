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

  await knex.schema.createTable('example', (def) => {
    def.uuid('id').defaultTo(knex.raw('uuid_generate_v4()'))
    def.string('owner', 48).notNullable()
    def
      .enum('state', ['created', 'allocated'], {
        enumName: 'example_state',
        useNative: true,
      })
      .notNullable()
    def.uuid('parameters_attachment_id').notNullable()
    def.integer('latest_token_id')
    def.integer('original_token_id')
    def.datetime('created_at').notNullable().defaultTo(now())
    def.datetime('updated_at').notNullable().defaultTo(now())
    def.primary(['id'])
    def
      .foreign('parameters_attachment_id')
      .references('id')
      .inTable('attachment')
      .onDelete('CASCADE')
      .onUpdate('CASCADE')
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
    def.datetime('created_at').notNullable().defaultTo(now())
    def.datetime('updated_at').notNullable().defaultTo(now())
    def.integer('token_id')
    def.primary(['id'])
    def.specificType('hash', 'CHAR(64)').notNullable()
    def.enu('api_type', ['example_a', 'example_b'], { useNative: true, enumName: 'api_type' })
    def.enu('transaction_type', ['creation', 'proposal', 'accept'], { useNative: true, enumName: 'transaction_type' })
    def.unique(['id', 'local_id'], { indexName: 'transaction-id-local-id' })
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('attachment')
  await knex.schema.dropTable('example')
  await knex.schema.dropTable('transaction')
  await knex.schema.dropTable('processed_blocks')
  await knex.raw('DROP EXTENSION "uuid-ossp"')
}
