import { CertificateRow, TransactionRow } from '../../src/lib/db'

export type Request = Record<string | symbol | number, Payload>
export type GetCertificateResponse = CertificateRow
export type ListCertificatesResponse = CertificateRow[]
export type GetTransactionResponse = TransactionRow
export type ListTransactionResponse = TransactionRow[]
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
