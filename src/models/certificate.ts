import { CertificateRow } from '../../src/lib/db'
import { UUID } from './strings'

export type Request = Record<string, Payload>
export type Response = Record<string, string | CertificateRow[]>
/**
 * Certificate Request Body example
 * @example {
 *   "id": "52907745-7672-470e-a803-a2f8feb52944",
 *   "co2e": 20,
 *   "capacity": 1,
 * }
 */
export interface Payload {
  co2e?: number
  capacity?: number
  /**
   * uuid generated using knex
   * this is normally what it would be returned
   */
  id?: UUID
  commits?: Record<string, string>
}
