import Database from '../../src/lib/db/index.js'
import { notSelfAddress, regulatorAddress, selfAddress } from '../helpers/mock.js'

const db = new Database()

export const cleanup = async () => {
  await db.delete('attachment', {})
  await db.delete('certificate', {})
  await db.delete('transaction', {})
}

export const seed = async () => {
  await cleanup()
  const [attachment] = await db.insert('attachment', {
    filename: 'testing-revocation',
    size: 0,
    ipfs_hash: 'QmXVStDC6kTpVHY1shgBQmyA4SuSrYnNRnHSak5iB6Eehn',
  })
  return attachment
}

export const updateSeed = async () => {
  await cleanup()

  const [cert] = await db.insert('certificate', {
    hydrogen_owner: notSelfAddress,
    energy_owner: selfAddress,
    regulator: regulatorAddress,
    hydrogen_quantity_wh: '1000000',
    latest_token_id: 1,
    original_token_id: 1,
    commitment: 'd2993129495123cb1591061f615de4da', // matches { production_start_time: new Date('2023-12-01T00:00:00.000Z'), production_end_time: new Date('2023-12-02T00:00:00.000Z'), energy_consumed_wh: 2000000, commitment_salt: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }
    commitment_salt: null,
    energy_consumed_wh: null,
    production_end_time: null,
    production_start_time: null,
  })

  return cert
}
