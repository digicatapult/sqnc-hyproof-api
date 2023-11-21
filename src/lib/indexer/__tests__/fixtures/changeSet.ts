import { AttachmentRecord, ChangeSet, ExampleRecord } from '../../changeSet'

export const changeSets2: ChangeSet[] = [
  {
    examples: new Map([['1', { id: '1', type: 'update', latest_token_id: 1, state: 'created' }]]),
  },
  {
    examples: new Map([
      ['1', { id: '1', type: 'update', latest_token_id: 1, state: 'created' }],
      ['3', { id: '3', type: 'update', latest_token_id: 3, state: 'created' }],
    ]),
  },
]

export const findIdTestSet: ChangeSet = {
  attachments: new Map<string, AttachmentRecord>([
    [
      '0x01',
      {
        id: '0x01',
        ipfs_hash: '01',
        type: 'insert',
      },
    ],
  ]),
  examples: new Map<string, ExampleRecord>([
    [
      '0x02',
      {
        type: 'update',
        id: '0x02',
        state: 'created',
        latest_token_id: 42,
      },
    ],
  ]),
}
