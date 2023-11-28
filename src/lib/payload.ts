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
  process: { id: 'process_initiate_cert', version: 1 },
  inputs: [],
  outputs: [
    {
      roles: { Owner: certificate.owner },
      metadata: {
        version: { type: 'LITERAL', value: '1' },
        type: { type: 'LITERAL', value: 'CERTIFICATE' },
        state: { type: 'LITERAL', value: certificate.state },
        co2e: { type: 'LITERAL', value: certificate.co2e },
        capacity: { type: 'LITERAL', value: certificate.capacity },
      },
    },
  ],
})

// TODO this is not updated, please update as per above
/**
  pub fn issue_cert |input: InitiatedCert| => |output: IssuedCert| where {
  output == input,
  input.hydrogen_owner == output.hydrogen_owner,
  input.energy_owner == output.energy_owner,
  output.hydrogen_owner != sender,
  output.energy_owner == sender,
 */
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
