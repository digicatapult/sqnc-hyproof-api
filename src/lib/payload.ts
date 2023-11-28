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

/*
pub fn initiate_cert || => |output: InitiatedCert| where {
  output.hydrogen_owner == sender,
  output.energy_owner != sender,
}
'@version'
'@type'
TODO: identities
- hydrogen_owner
- hydrogen_producer
*/
export const processInitiateCert = (certificate: CertificateRow): Payload => ({
  process: { id: 'initiate_cert', version: 1 },
  inputs: [],
  outputs: [
    {
      roles: { hydrogen_owner: certificate.hydrogen_owner, energy_owner: certificate.energy_owner },
      metadata: {
        '@version': { type: 'LITERAL', value: '1' },
        '@type': { type: 'LITERAL', value: 'CERTIFICATE' },
        hydrogen_quantity_mwh: { type: 'LITERAL', value: certificate.hydrogen_quantity_mwh },
        commitment: { type: 'LITERAL', value: '' },
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
