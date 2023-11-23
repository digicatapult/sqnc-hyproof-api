import { UUID } from './strings'

/**
 * The possible states of a chain transaction
 */
export type TransactionState = 'submitted' | 'inBlock' | 'finalised' | 'failed'

/**
 * A transaction returned by the API
 */
export interface TransactionResponse {
  id: UUID
  state: TransactionState
  api_type: TransactionApiType
  transaction_type: TransactionType
  submitted_at: Date
  updated_at: Date
}

/**
 * The type of the entity involved in the transaction
 */
export type TransactionApiType = 'example' | 'example_a' | 'example_b'

/**
 * Transaction type - matches the endpoint that initiates the transaction
 */
export type TransactionType = 'creation' | 'proposal' | 'accept' | 'comment' | 'rejection' | 'cancellation'
