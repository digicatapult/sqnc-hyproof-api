import { v4 as UUIDv4 } from 'uuid'

import { UUID } from '../../models/strings'
import { TransactionRow } from '../db'
import { ChangeSet, CertificateRecord } from './changeSet'

const processNames = ['process_initiate_cert'] as const
type PROCESSES_TUPLE = typeof processNames
type PROCESSES = PROCESSES_TUPLE[number]

const processNameSet: Set<string> = new Set(processNames)

export const ValidateProcessName = (name: string): name is PROCESSES => processNameSet.has(name)

export type EventProcessors = {
  [key in PROCESSES]: (
    version: number,
    transaction: TransactionRow | null,
    sender: string,
    inputs: { id: number; localId: UUID }[],
    outputs: { id: number; roles: Map<string, string>; metadata: Map<string, string> }[]
  ) => ChangeSet
}

const getOrError = <T>(map: Map<string, T>, key: string): T => {
  const val = map.get(key)
  if (val === undefined) {
    throw new Error(`Invalid token detected onchain. Missing prop ${key}`)
  }
  return val
}

/* TODO uncomment if we decided to use attachments
const attachmentPayload = (map: Map<string, string>, key: string): AttachmentRecord => ({
  type: 'insert',
  id: UUIDv4(),
  ipfs_hash: getOrError(map, key),
})
*/

const DefaultEventProcessors: EventProcessors = {
  process_initiate_cert: (version, transaction, _sender, _inputs, outputs) => {
    if (version !== 1) throw new Error(`Incompatible version ${version} for process_initiate_cert process`)

    const newCertificateId = outputs[0].id
    const newCertificate = outputs[0]

    if (transaction) {
      const id = transaction.localId
      return {
        certificates: new Map([
          [
            id,
            {
              type: 'update',
              id,
              state: 'created',
              latest_token_id: newCertificateId,
              original_token_id: newCertificateId,
            },
          ],
        ]),
      }
    }

    // const attachment: AttachmentRecord = attachmentPayload(newCertificate.metadata, 'parameters')
    const certificate: CertificateRecord = {
      type: 'insert',
      id: UUIDv4(),
      owner: getOrError(newCertificate.roles, 'owner'),
      state: 'initialized',
      co2e: getOrError(newCertificate.metadata, 'co2e'),
      capacity: getOrError(newCertificate.metadata, 'capacity'),
      latest_token_id: newCertificate.id,
      original_token_id: newCertificate.id,
      parameters_attachment_id: '',
    }

    return {
      certificates: new Map([[certificate.id, certificate]]),
    }
  },
}

export default DefaultEventProcessors
