import knex from 'knex'

import { pgConfig } from './knexfile'
import { z } from 'zod'
import { singleton } from 'tsyringe'
import type { IDatabase, TABLE, Models, Where, Update, Order } from './zod-models'
import Zod, { tablesList } from './zod-models'

const clientSingleton = knex(pgConfig)

@singleton()
export default class Database {
  private db: IDatabase

  constructor(private client = clientSingleton) {
    this.client = client
    const models: IDatabase = tablesList.reduce((acc, name) => {
      return {
        [name]: () => clientSingleton(name),
        ...acc,
      }
    }, {}) as IDatabase
    this.db = models
  }

  // backlog item for if statement model === logic has been added and returns etc
  insert = async <M extends TABLE>(
    model: M,
    record: Models[typeof model]['insert']
  ): Promise<Models[typeof model]['get'][]> => {
    return z.array(Zod[model].get).parse(await this.db[model]().insert(record).returning('*'))
  }

  delete = async <M extends TABLE>(model: M, where: Where<M>): Promise<void> => {
    return this.db[model]()
      .where(where || {})
      .delete()
  }

  update = async <M extends TABLE>(
    model: M,
    where: Where<M>,
    updates: Update<M>
  ): Promise<Models[typeof model]['get'][]> => {
    let query = this.db[model]().update({
      ...updates,
      updated_at: this.client.fn.now(),
    })
    if (!Array.isArray(where)) {
      where = [where]
    }
    query = where.reduce((acc, w) => (Array.isArray(w) ? acc.where(w[0], w[1], w[2]) : acc.where(w)), query)

    return z.array(Zod[model].get).parse(await query.returning('*'))
  }

  get = async <M extends TABLE>(
    model: M,
    where?: Where<M>,
    order?: Order<M>,
    limit?: number
  ): Promise<Models[typeof model]['get'][]> => {
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
    return z.array(Zod[model].get).parse(result)
  }

  withTransaction = (update: (db: Database) => Promise<void>) => {
    return this.client.transaction(async (trx) => {
      const decorated = new Database(trx)
      await update(decorated)
    })
  }
}
