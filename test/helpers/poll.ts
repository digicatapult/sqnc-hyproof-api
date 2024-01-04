import Database from '../../src/lib/db'
import { TransactionRow } from '../../src/lib/db/types'
import { TransactionState } from '../../src/models/transaction'
import { UUID } from '../../src/models/strings'

export const pollTransactionState = async (
  db: Database,
  transactionId: UUID,
  targetState: TransactionState,
  delay = 1000,
  maxRetry = 30
): Promise<TransactionRow> => {
  let retry = 0

  const poll = async (): Promise<TransactionRow> => {
    if (retry >= maxRetry) {
      throw new Error(
        `Maximum number of retries exceeded while waiting for transaction ${transactionId} to reach state ${targetState}`
      )
    }

    const [transaction]: TransactionRow[] = await db.get('transaction', { id: transactionId })
    if (transaction.state === targetState) {
      return transaction
    }

    retry += 1

    return new Promise((resolve) => setTimeout(resolve, delay)).then(poll)
  }

  return poll().then((value) => {
    return new Promise((resolve) => {
      setTimeout(() => resolve(value), delay)
    })
  })
}
