import { UUID } from './strings.js'

export type GetAttachmentResponse = {
  id: UUID
  filename: string | null
  size: number | null
  ipfs_hash: string
  created_at: Date
}
export type ListAttachmentsResponse = GetAttachmentResponse[]
