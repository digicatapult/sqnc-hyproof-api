import { v4 as UUIDv4 } from 'uuid'

import { UUID } from '../../models/strings'
import { TransactionRow } from '../db'
import { ChangeSet, CertificateRecord } from './changeSet'

const processNames = ['initiate_cert'] as const
type PROCESSES_TUPLE = typeof processNames
type PROCESSES = PROCESSES_TUPLE[number]

const processNameSet: Set<string> = new Set(processNames)

export const ValidateProcessName = (name: string): name is PROCESSES => processNameSet.has(name)

export type EventProcessors = {
  [key in PROCESSES]: (args: {
    version: number
    transaction?: TransactionRow
    sender?: string
    inputs?: { id: number; local_id: UUID }[]
    outputs: { id: number; roles: Map<string, string>; metadata: Map<string, string> }[]
  }) => ChangeSet
}

const getOrError = <T>(map: Map<string, T>, key: string): T => {
  const val = map.get(key)
  if (val === undefined) {
    throw new Error(`Invalid token detected onchain. Missing prop ${key}`)
  }
  return val
}

const parseIntegerOrThrow = (value: string): number => {
  const result = parseInt(value, 10)
  if (!Number.isSafeInteger(result)) {
    throw new Error('Expected an integer for field')
  }
  return result
}

/* TODO uncomment if we decided to use attachments
const attachmentPayload = (map: Map<string, string>, key: string): AttachmentRecord => ({
  type: 'insert',
  id: UUIDv4(),
  ipfs_hash: getOrError(map, key),
})
*/

const DefaultEventProcessors: EventProcessors = {
  initiate_cert: ({ version, transaction, outputs }) => {
    if (version !== 1) throw new Error(`Incompatible version ${version} for initiate_cert process`)
    const { id: latest_token_id, ...cert } = outputs[0]

    if (transaction) {
      const id = transaction.local_id
      return {
        certificates: new Map([
          [
            id,
            {
              type: 'update',
              state: 'created',
              id,
              latest_token_id,
              original_token_id: latest_token_id,
            },
          ],
        ]),
      }
    }

    const certificate: CertificateRecord = {
      type: 'insert',
      id: UUIDv4(),
      state: 'created',
      hydrogen_owner: getOrError(cert.roles, 'hydrogen_owner'),
      energy_owner: getOrError(cert.roles, 'energy_owner'),
      hydrogen_quantity_mwh: parseIntegerOrThrow(getOrError(cert.metadata, 'hydrogen_quantity_mwh')),
      latest_token_id,
      original_token_id: latest_token_id,
    }

    return {
      certificates: new Map([[certificate.id, certificate]]),
    }
  },
}

export default DefaultEventProcessors
