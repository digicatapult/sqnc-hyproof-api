import { UUID } from './strings'

export type Request = Record<string, Payload>
export type GetAttachmentResponse = {
  id: UUID
  filename: string | null
  size: number | null
  ipfs_hash: string
  created_at: Date
}
export type ListAttachmentsResponse = GetAttachmentResponse[]

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
