import { v4 as UUIDv4 } from 'uuid'

import { UUID } from '../../models/strings'
import { TransactionRow } from '../db'
import { AttachmentRecord, ChangeSet, ExampleRecord } from './changeSet'

const processNames = ['example-create'] as const
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

const attachmentPayload = (map: Map<string, string>, key: string): AttachmentRecord => ({
  type: 'insert',
  id: UUIDv4(),
  ipfs_hash: getOrError(map, key),
})

const DefaultEventProcessors: EventProcessors = {
  'example-create': (version, transaction, _sender, _inputs, outputs) => {
    if (version !== 1) throw new Error(`Incompatible version ${version} for example-create process`)

    const newExampleId = outputs[0].id
    const newExample = outputs[0]

    if (transaction) {
      const id = transaction.localId
      return {
        examples: new Map([
          [
            id,
            { type: 'update', id, state: 'created', latest_token_id: newExampleId, original_token_id: newExampleId },
          ],
        ]),
      }
    }

    const attachment: AttachmentRecord = attachmentPayload(newExample.metadata, 'parameters')
    const example: ExampleRecord = {
      type: 'insert',
      id: UUIDv4(),
      owner: getOrError(newExample.roles, 'owner'),
      subtype: getOrError(newExample.metadata, 'subtype'),
      state: 'created',
      parameters_attachment_id: attachment.id,
      latest_token_id: newExample.id,
      original_token_id: newExample.id,
    }

    return {
      attachments: new Map([[attachment.id, attachment]]),
      examples: new Map([[example.id, example]]),
    }
  },
}

export default DefaultEventProcessors
