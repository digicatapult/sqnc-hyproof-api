import { bs58ToHex } from '../utils/controller-helpers'
import { CertificateRow } from './db'

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

export const processInitiateCert = (certificate: CertificateRow): Payload => ({
  process: { id: 'initiate_cert', version: 1 },
  inputs: [],
  outputs: [
    {
      roles: { hydrogen_owner: certificate.hydrogen_owner, energy_owner: certificate.energy_owner },
      metadata: {
        '@version': { type: 'LITERAL', value: '1' },
        '@type': { type: 'LITERAL', value: 'InitiatedCert' },
        hydrogen_quantity_mwh: { type: 'LITERAL', value: certificate.hydrogen_quantity_mwh.toString() },
        commitment: { type: 'LITERAL', value: certificate.commitment },
      },
    },
  ],
})

// TODO this is not updated, please update as per above
// when working on issue please refer to the process flow
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
