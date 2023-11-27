import { UUID } from './strings'

export type GetCertificateResponse = {
  id: UUID
  state: 'pending' | 'initiated' | 'issued' | 'revoked'
  hydrogen_owner: string
  energy_owner: string
  regulator: string
  hydrogen_quantity_mwh: number
  embodied_co2?: number | null
  original_token_id?: number | null
  latest_token_id?: number | null
  created_at: Date
  updated_at: Date
  commitment: string
  commitment_salt?: string | null
  production_start_time?: Date | null
  production_end_time?: Date | null
  energy_consumed_mwh?: number | null
}
export type ListCertificatesResponse = GetCertificateResponse[]
export type GetTransactionResponse = {
  id: UUID
  api_type: 'certificate' | 'example_a' | 'example_b'
  transaction_type: 'issue_cert' | 'initiate_cert' | 'revoke_cert'
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
 *   "energy_owner": "emma",
 *   "production_start_time": "2023-01-01T00:00:00.000Z",
 *   "production_end_time": "2023-01-01T12:00:00.000Z",
 *   "energy_consumed_mwh": 1,
 * }
 */
export type Payload = {
  hydrogen_quantity_mwh: number
  energy_owner: string
  regulator: string
  production_start_time: Date
  production_end_time: Date
  energy_consumed_mwh: number
}

export type UpdatePayload = {
  production_start_time: Date
  production_end_time: Date
  energy_consumed_mwh: number
  commitment_salt: string
}

export type RevokePayload = {
  reason_id: UUID
}

export type IssuancePayload = {
  embodied_co2?: number
}
