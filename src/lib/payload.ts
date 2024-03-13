import { AttachmentRow, CertificateRow } from './db/types.js'
import { bs58ToHex } from '../utils/controller-helpers.js'

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
      roles: {
        regulator: certificate.regulator,
        hydrogen_owner: certificate.hydrogen_owner,
        energy_owner: certificate.energy_owner,
      },
      metadata: {
        '@version': { type: 'LITERAL', value: '1' },
        '@type': { type: 'LITERAL', value: 'InitiatedCert' },
        hydrogen_quantity_wh: { type: 'LITERAL', value: certificate.hydrogen_quantity_wh.toString() },
        commitment: { type: 'LITERAL', value: certificate.commitment },
      },
    },
  ],
})

export const processIssueCert = (certificate: CertificateRow): Payload => ({
  process: { id: 'issue_cert', version: 1 },
  inputs: [certificate.latest_token_id || Number.NaN],
  outputs: [
    {
      roles: {
        regulator: certificate.regulator,
        hydrogen_owner: certificate.hydrogen_owner,
        energy_owner: certificate.energy_owner,
      },
      metadata: {
        '@version': { type: 'LITERAL', value: '1' },
        '@type': { type: 'LITERAL', value: 'IssuedCert' },
        '@original_id': { type: 'TOKEN_ID', value: certificate.original_token_id || Number.NaN },
        embodied_co2: { type: 'LITERAL', value: `${certificate.embodied_co2}` },
      },
    },
  ],
})

export const processRevokeCert = (certificate: CertificateRow, attachment: AttachmentRow): Payload => ({
  process: { id: 'revoke_cert', version: 1 },
  inputs: [certificate.latest_token_id || Number.NaN],
  outputs: [
    {
      roles: {
        regulator: certificate.regulator,
        hydrogen_owner: certificate.hydrogen_owner,
        energy_owner: certificate.energy_owner,
      },
      metadata: {
        '@version': { type: 'LITERAL', value: '1' },
        '@type': { type: 'LITERAL', value: 'RevokedCert' },
        '@original_id': { type: 'TOKEN_ID', value: certificate.original_token_id || Number.NaN },
        reason: { type: 'FILE', value: bs58ToHex(attachment.ipfs_hash) },
      },
    },
  ],
})
