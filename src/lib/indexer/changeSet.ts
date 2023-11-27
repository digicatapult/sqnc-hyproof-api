import { UUID } from '../../models/strings'

type ChangeOperation = 'insert' | 'update'

interface Change {
  type: ChangeOperation
}

export type CertificateRecord =
  | {
      type: 'insert'
      id: string
      owner: string
      state: string
      co2e: string
      capacity: string
      parameters_attachment_id: string
      latest_token_id: number
      original_token_id: number
    }
  | {
      type: 'update'
      id: string
      state: string
      original_token_id?: number
      latest_token_id: number
    }

export type AttachmentRecord = {
  type: 'insert'
  id: string
  filename?: string
  ipfs_hash: string
  size?: number
}

export type ChangeSet = {
  attachments?: Map<string, AttachmentRecord>
  certificates?: Map<string, CertificateRecord>
}

const mergeMaps = <T extends Change>(base?: Map<string, T>, update?: Map<string, T>) => {
  if (!update) {
    return base
  }

  const result = base || new Map<string, T>()
  for (const [key, value] of update) {
    const base = result.get(key) || { type: 'update' }
    const operation = base.type === 'insert' || value.type === 'insert' ? 'insert' : 'update'
    result.set(key, {
      ...base,
      ...value,
      type: operation,
    })
  }

  return result
}

export const mergeChangeSets = (base: ChangeSet, update: ChangeSet) => {
  const certificates = mergeMaps(base.certificates, update.certificates)
  const attachments = mergeMaps(base.attachments, update.attachments)

  const result: ChangeSet = {
    ...(attachments ? { attachments } : {}),
    ...(certificates ? { certificates } : {}),
  }

  return result
}

export const findLocalIdInChangeSet = (change: ChangeSet, tokenId: number): UUID | null => {
  const matchRecordValues = [...(change.certificates?.values() || [])]
  // idea to have multiple here

  const match = [...matchRecordValues].find((el) => el.latest_token_id === tokenId)
  return match?.id || null
}
