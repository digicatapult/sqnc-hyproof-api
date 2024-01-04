import Database from '../../src/lib/db'

const db = new Database()

export const cleanup = async () => {
  await db.delete('attachment', {})
}

export const attachmentSeed = async () => {
  await cleanup()
  return await db.insert('attachment', {
    filename: 'test.txt',
    ipfs_hash: 'QmXVStDC6kTpVHY1shgBQmyA4SuSrYnNRnHSak5iB6Eehn',
    size: 42,
  })
}
