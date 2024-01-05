import Database from '../../src/lib/db/index.js'
import { TransactionRow } from '../../src/lib/db/types.js'
import { TransactionState } from '../../src/models/transaction.js'
import { UUID } from '../../src/models/strings.js'

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
