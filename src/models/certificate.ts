import { CertificateRow, Entity } from '../../src/lib/db'

export type Request = Record<string | symbol | number, Payload>
export type Response = Record<string, string | number | Entity | CertificateRow[]> | string
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
