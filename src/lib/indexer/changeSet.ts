import { UUID } from '../../models/strings'

type ChangeOperation = 'insert' | 'update'

interface Change {
  type: ChangeOperation
}

export type CertificateRecord =
  | {
      type: 'insert'
      id: UUID
      hydrogen_owner: string
      energy_owner: string
      hydrogen_quantity_mwh: number
      state: 'pending' | 'initiated' | 'issued' | 'revoked'
      latest_token_id: number
      original_token_id: number
      commitment: string
      commitment_salt: null
      production_start_time: null
      production_end_time: null
      energy_consumed_mwh: null
    }
  | {
      type: 'update'
      id: UUID
      state: 'pending' | 'initiated' | 'issued' | 'revoked'
      embodied_co2?: number
      original_token_id?: number
      latest_token_id: number
    }
  | never

export type AttachmentRecord =
  | {
      type: 'insert'
      id: string
      filename: string | null
      ipfs_hash: string
      size: number | null
    }
  | never

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
