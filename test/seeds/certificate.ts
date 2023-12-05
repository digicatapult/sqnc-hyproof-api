import Database from '../../src/lib/db'

const db = new Database()

export const cleanup = async () => {
  await db.delete('attachment', {})
  await db.delete('certificate', {})
  await db.delete('transaction', {})
}

export const seed = async () => {
  await cleanup()
}
