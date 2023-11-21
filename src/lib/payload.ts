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

export const processExample = (example: Record<string, string>): Payload => ({
  process: { id: 'processExample', version: 1 },
  inputs: [],
  outputs: [
    {
      roles: { Owner: example.owner },
      metadata: {
        version: { type: 'LITERAL', value: '1' },
        type: { type: 'LITERAL', value: 'EXAMPLE' },
        state: { type: 'LITERAL', value: 'created' },
        subtype: { type: 'LITERAL', value: example.subtype },
        parameters: { type: 'FILE', value: bs58ToHex(example.ipfs_hash) },
      },
    },
  ],
})
