import { UUID } from './strings'

/**
 * The possible states of a chain transaction
 */
export type TransactionState = 'submitted' | 'inBlock' | 'finalised' | 'failed'
export type TransactionApiType = 'certificate' | 'example_a' | 'example_b'

export type GetTransactionResponse = {
  id: UUID
  api_type: TransactionApiType
  transaction_type: TransactionType
  state: TransactionState
  local_id: string
  hash: string
  created_at: Date
  updated_at: Date
}
export type ListTransactionResponse = GetTransactionResponse[]

/**
 * The type of the entity involved in the transaction
 */

/**
 * Transaction type - matches the endpoint that initiates the transaction
 */
export type TransactionType = 'issue_cert' | 'initiate_cert'
