import { UUID } from './strings'

import { AttachmentRow } from '../lib/db'
import { Readable } from 'node:stream'

export type Request = Record<string, Payload>
export type Response = Record<string, string | AttachmentRow[]> | string | Readable

/**
 * File or JSON attachment
 * @example [{
 *   "id": "string",
 *   "filename": "string",
 *   "size": 1024,
 *   "createdAt": "2023-03-16T13:18:42.357Z"
 * }]
 */
export interface Payload {
  /**
   * uuid generated using knex
   */
  id: UUID
  /**
   * for json files name will be 'json'
   */
  filename: string | 'json' | null
  size: number | null
  createdAt: Date
}
