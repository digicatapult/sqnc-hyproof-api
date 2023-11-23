import { UUID } from './strings'

export type Request = { [k: string]: string }
export type Response = { [k: string]: string }

/**
 * File or JSON attachment
 * @example [{
 *   "id": "string",
 *   "createdAt": "2023-03-16T13:18:42.357Z"
 * }]
 */
export interface Example {
  /**
   * uuid generated using knex
   */
  id: UUID
  /**
   * for json files name will be 'json'
   */
  filename: string | 'json' | null
  createdAt: Date
}
