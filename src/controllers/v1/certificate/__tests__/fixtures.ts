import { CertificateRow, TransactionRow, AttachmentRow, CertificateEventRow } from '../../../../lib/db/types.js'

export const attachmentExample = {
  filename: 'testing-revocation',
  size: 0,
  ipfs_hash: 'QmXVStDC6kTpVHY1shgBQmyA4SuSrYnNRnHSak5iB6Eehn',
} as AttachmentRow

export const transactionExample = {
  id: 'initiate-cert-transaction-test',
  api_type: 'certificate',
  local_id: 'test-cert-1',
  state: 'submitted',
  transaction_type: 'initiate_cert',
} as TransactionRow

export const certExamples = [
  { id: 'test-cert-1', state: 'issued', energy_owner: 'emma-test', regulator: 'ray-test', hydrogen_owner: 'heidi' },
  { id: 'test-cert-4', state: 'initiated', energy_owner: 'emma2-test', regulator: 'ray-test', hydrogen_owner: 'heidi' },
  {
    id: 'test-cert-3',
    state: 'initiated',
    energy_owner: 'member-self-test',
    regulator: 'ray-test',
    latest_token_id: 3,
    hydrogen_owner: 'member-self-test',
    hydrogen_quantity_wh: '10000000',
    commitment: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    production_start_time: new Date('2024-01-03T15:17:58.836Z'),
    production_end_time: new Date('2024-01-03T18:17:58.836Z'),
    energy_consumed_wh: '5000000',
  },
  {
    id: 'test-cert-2',
    state: 'pending',
    energy_owner: 'member-self-test',
    regulator: 'ray-test',
    hydrogen_owner: 'member-self-test',
    hydrogen_quantity_wh: '10000000',
  },
  {
    id: 'test-cert-5',
    state: 'initiated',
    energy_owner: 'emma-test',
    regulator: 'member-self-test',
    hydrogen_owner: 'heidi',
    hydrogen_quantity_wh: '10000000',
    commitment: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    production_start_time: new Date('2024-01-03T15:17:58.836Z'),
    production_end_time: new Date('2024-01-03T18:17:58.836Z'),
    energy_consumed_wh: '5000000',
  },
] as CertificateRow[]

const baseEvent = {
  id: 'id',
  created_at: new Date('2024-01-02'),
  certificate_id: 'id',
}
export const eventExamplesById = {
  ['test-cert-1']: [
    { event: 'issued', occurred_at: new Date('2024-01-02'), ...baseEvent },
    { event: 'initiated', occurred_at: new Date('2024-01-01'), ...baseEvent },
  ],
  ['test-cert-4']: [{ event: 'initiated', occurred_at: new Date('2024-01-01'), ...baseEvent }],
  ['test-cert-3']: [{ event: 'initiated', occurred_at: new Date('2024-01-01'), ...baseEvent }],
  ['test-cert-2']: [],
  ['test-cert-5']: [{ event: 'initiated', occurred_at: new Date('2024-01-01'), ...baseEvent }],
} as { [key in string]: CertificateEventRow[] }
