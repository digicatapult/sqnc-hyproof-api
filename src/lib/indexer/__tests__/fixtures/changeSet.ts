import { AttachmentRecord, CertificateRecord, ChangeSet } from '../../changeSet'

export const changeSets2: ChangeSet[] = [
  {
    certificates: new Map([['1', { id: '1', type: 'update', latest_token_id: 1, state: 'initialized' }]]),
  },
  {
    certificates: new Map([
      ['1', { id: '1', type: 'update', latest_token_id: 1, state: 'initialized' }],
      ['3', { id: '3', type: 'update', latest_token_id: 3, state: 'initialized' }],
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
  certificates: new Map<string, CertificateRecord>([
    [
      '0x02',
      {
        type: 'update',
        id: '0x02',
        state: 'initialise',
        latest_token_id: 42,
      },
    ],
  ]),
}
