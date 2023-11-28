import { bs58ToHex } from '../utils/controller-helpers'

export interface Payload {
  process: { id: string; version: number }
  inputs: number[]
  outputs: Output[]
}

export interface Output {
  roles: Record<string, string>
  metadata: Metadata
}

export interface MetadataFile {
  blob: Blob
  filename: string
}

export type Metadata = Record<string, { type: string; value: string | number }>

export const processInitiateCert = (certificate: Record<string, string>): Payload => ({
  process: { id: 'process_initiate_cert', version: 1 },
  inputs: [],
  outputs: [
    {
      roles: { Owner: certificate.owner },
      metadata: {
        version: { type: 'LITERAL', value: '1' },
        type: { type: 'LITERAL', value: 'EXAMPLE' },
        state: { type: 'LITERAL', value: 'created' },
        subtype: { type: 'LITERAL', value: certificate.subtype },
        parameters: { type: 'FILE', value: bs58ToHex(certificate.ipfs_hash) },
      },
    },
  ],
})

export const processIssueCert = (certificate: Record<string, string>): Payload => ({
  process: { id: 'process_issue_cert', version: 1 },
  inputs: [],
  outputs: [
    {
      roles: { Owner: certificate.owner },
      metadata: {
        version: { type: 'LITERAL', value: '1' },
        type: { type: 'LITERAL', value: 'EXAMPLE' },
        state: { type: 'LITERAL', value: 'created' },
        subtype: { type: 'LITERAL', value: certificate.subtype },
        parameters: { type: 'FILE', value: bs58ToHex(certificate.ipfs_hash) },
      },
    },
  ],
})
