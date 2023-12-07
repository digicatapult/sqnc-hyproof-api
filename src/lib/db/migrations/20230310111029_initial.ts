import { Knex } from 'knex'

// INFO we shoyuld use createSchema....
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
    def.integer('hydrogen_quantity_mwh').notNullable().index('hydrogen_quantity_mwh_index')
    def.integer('embodied_co2').nullable().index('embodied_co2_index').defaultTo(null)
    def
      .enum('energy_source', ['grid', 'renewable'], {
        useNative: true,
        enumName: 'energy_source',
      })
      .nullable()
      .defaultTo(null)
    def.string('energy_owner', 48).notNullable()
    def.string('hydrogen_owner', 48).notNullable()
    def.string('regulator', 48).notNullable()
    def.dateTime('production_start_time').nullable().defaultTo(null)
    def.dateTime('production_end_time').nullable().defaultTo(null)
    def.integer('energy_consumed_mwh').nullable().defaultTo(null)
    def.string('commitment_salt', 32).nullable().defaultTo(null)
    def.string('commitment', 32).notNullable()
    def
      .enum('state', ['pending', 'initiated', 'issued', 'revoked', 'cancelled'], {
        useNative: true,
        enumName: 'certificate_state',
      })
      .defaultTo('pending')
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
    def.specificType('hash', 'CHAR(66)').notNullable()
    def.enum('api_type', ['certificate'], { useNative: true, enumName: 'api_type' }).notNullable()
    def
      .enum('transaction_type', ['initiate_cert', 'issue_cert'], { useNative: true, enumName: 'transaction_type' })
      .notNullable()
    def.unique(['id', 'local_id'], { indexName: 'transaction-id-local-id' })
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('attachment')
  await knex.schema.dropTable('certificate')
  await knex.schema.dropTable('transaction')
  await knex.schema.dropTable('processed_blocks')
  await knex.raw('DROP TYPE certificate_state')
  await knex.raw('DROP TYPE transaction_state')
  await knex.raw('DROP TYPE transaction_type')
  await knex.raw('DROP TYPE api_type')
  await knex.raw('DROP TYPE energy_source')
  await knex.raw('DROP EXTENSION "uuid-ossp"')
}
