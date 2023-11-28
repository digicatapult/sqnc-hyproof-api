import { CertificateRow, TransactionRow } from '../../src/lib/db'

export type Request = Record<any, Payload> 
export type Response = Record<string, string | number | CertificateRow[] | TransactionRow >
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
