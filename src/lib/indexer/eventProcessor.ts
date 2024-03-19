import { v4 as UUIDv4 } from 'uuid'

import { UUID } from '../../models/strings.js'
import { TransactionRow } from '../../lib/db/types.js'
import { ChangeSet, CertificateRecord, AttachmentRecord, CertificateEventRecord } from './changeSet.js'

const processNames = ['initiate_cert', 'issue_cert', 'revoke_cert'] as const
type PROCESSES_TUPLE = typeof processNames
type PROCESSES = PROCESSES_TUPLE[number]

const processNameSet: Set<string> = new Set(processNames)

export const ValidateProcessName = (name: string): name is PROCESSES => processNameSet.has(name)

export type EventProcessors = {
  [key in PROCESSES]: (args: {
    version: number
    blockTime: Date
    transaction?: TransactionRow
    sender: string
    inputs: { id: number; local_id: UUID }[]
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

const parseIntegerOrThrow = (value: string): string => {
  const result = BigInt(value)
  return result.toString()
}

const attachmentPayload = (map: Map<string, string>, key: string): AttachmentRecord => ({
  type: 'insert',
  id: UUIDv4(),
  ipfs_hash: getOrError(map, key),
  filename: null,
  size: null,
})

const DefaultEventProcessors: EventProcessors = {
  initiate_cert: ({ version, blockTime, transaction, outputs }) => {
    if (version !== 1) throw new Error(`Incompatible version ${version} for initiate_cert process`)
    const { id: latest_token_id, ...cert } = outputs[0]

    const baseEvent: Omit<CertificateEventRecord, 'certificate_id'> = {
      type: 'insert',
      id: UUIDv4(),
      event: 'initiated',
      occurred_at: blockTime,
    }

    if (transaction) {
      const id = transaction.local_id
      return {
        certificates: new Map([
          [
            id,
            {
              type: 'update',
              state: 'initiated',
              id,
              latest_token_id,
              original_token_id: latest_token_id,
            },
          ],
        ]),
        certificateEvents: new Map([[baseEvent.id, { ...baseEvent, certificate_id: id }]]),
      }
    }

    const certificate: CertificateRecord = {
      type: 'insert',
      id: UUIDv4(),
      state: 'initiated',
      hydrogen_owner: getOrError(cert.roles, 'hydrogen_owner'),
      energy_owner: getOrError(cert.roles, 'energy_owner'),
      regulator: getOrError(cert.roles, 'regulator'),
      hydrogen_quantity_wh: parseIntegerOrThrow(getOrError(cert.metadata, 'hydrogen_quantity_wh')),
      latest_token_id,
      original_token_id: latest_token_id,
      commitment: getOrError(cert.metadata, 'commitment'),
      commitment_salt: null,
      energy_consumed_wh: null,
      production_end_time: null,
      production_start_time: null,
    }

    return {
      certificates: new Map([[certificate.id, certificate]]),
      certificateEvents: new Map([[baseEvent.id, { ...baseEvent, certificate_id: certificate.id }]]),
    }
  },
  issue_cert: ({ version, blockTime, inputs, outputs }) => {
    if (version !== 1) throw new Error(`Incompatible version ${version} for issue_cert process`)
    const { local_id } = inputs[0]
    const { id: latest_token_id, ...cert } = outputs[0]

    const embodied_co2 = parseIntegerOrThrow(getOrError(cert.metadata, 'embodied_co2'))

    const update: CertificateRecord = {
      id: local_id,
      type: 'update',
      latest_token_id,
      state: 'issued',
      embodied_co2,
    }
    const event: CertificateEventRecord = {
      type: 'insert',
      id: UUIDv4(),
      certificate_id: local_id,
      event: 'issued',
      occurred_at: blockTime,
    }

    return {
      certificates: new Map([[local_id, update]]),
      certificateEvents: new Map([[event.id, event]]),
    }
  },
  revoke_cert: ({ version, blockTime, transaction, inputs, outputs }) => {
    if (version !== 1) throw new Error(`Incompatible version ${version} for issue_cert process`)

    const { local_id } = inputs[0]
    const { id: latest_token_id, ...cert } = outputs[0]

    const update: CertificateRecord = {
      type: 'update',
      id: local_id,
      latest_token_id,
      state: 'revoked',
    }
    const event: CertificateEventRecord = {
      type: 'insert',
      id: UUIDv4(),
      certificate_id: local_id,
      event: 'revoked',
      occurred_at: blockTime,
    }

    if (transaction) {
      return {
        certificates: new Map([
          [
            local_id,
            {
              ...update,
              revocation_reason: getOrError(cert.metadata, 'reason'),
            },
          ],
        ]),
        certificateEvents: new Map([[event.id, event]]),
      }
    }

    const attachment: AttachmentRecord = attachmentPayload(cert.metadata, 'reason')
    update.revocation_reason = attachment.id

    return {
      certificates: new Map([[local_id, update]]),
      attachments: new Map([[attachment.id, attachment]]),
      certificateEvents: new Map([[event.id, event]]),
    }
  },
}

export default DefaultEventProcessors
