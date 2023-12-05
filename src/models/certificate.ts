import { UUID } from './strings'

export type GetCertificateResponse = {
  id: UUID
  state: 'pending' | 'initiated' | 'issued' | 'revoked'
  hydrogen_owner: string
  energy_owner: string
  hydrogen_quantity_mwh: number
  embodied_co2?: number | null
  original_token_id?: number | null
  latest_token_id?: number | null
  created_at: Date
  updated_at: Date
}
export type ListCertificatesResponse = GetCertificateResponse[]
export type GetTransactionResponse = {
  id: UUID
  api_type: 'certificate' | 'example_a' | 'example_b'
  state: 'submitted' | 'inBlock' | 'finalised' | 'failed'
  local_id: string
  hash: string
  created_at: Date
  updated_at: Date
}
export type ListTransactionResponse = GetTransactionResponse[]
/**
 * Certificate Request Body example
 * @example {
 *   "hydrogen_quantity_mwh": 1,
 *   "energy_owner": "emma"
 * }
 */
export type Payload = {
  hydrogen_quantity_mwh: number
  energy_owner: string
}
