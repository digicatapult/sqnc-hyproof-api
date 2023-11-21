import Database from '../../src/lib/db'

const db = new Database().db()

export const parametersAttachmentId = 'a789ad47-91c3-446e-90f9-a7c9b233eaf8'
export const exampleDate = '2023-01-01T00:00:00.000Z'

export const cleanup = async () => {
  await db.attachment().del()
}

export const attachmentSeed = async () => {
  await cleanup()
  await db.attachment().insert([
    {
      id: parametersAttachmentId,
      filename: 'test.txt',
      ipfs_hash: 'QmXVStDC6kTpVHY1shgBQmyA4SuSrYnNRnHSak5iB6Eehn',
      size: 42,
      created_at: exampleDate,
    },
  ])
}
