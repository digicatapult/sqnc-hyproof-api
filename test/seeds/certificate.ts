import Database from '../../src/lib/db'
import { notSelfAddress, regulatorAddress, selfAddress } from '../helpers/mock'

const db = new Database()

export const cleanup = async () => {
  await db.delete('attachment', {})
  await db.delete('certificate', {})
  await db.delete('transaction', {})
}

export const seed = async () => {
  await cleanup()
}

export const updateSeed = async () => {
  await cleanup()

  const [cert] = await db.insert('certificate', {
    hydrogen_owner: notSelfAddress,
    energy_owner: selfAddress,
    regulator: regulatorAddress,
    hydrogen_quantity_mwh: 1,
    latest_token_id: 1,
    original_token_id: 1,
    commitment: 'ffb693f99a5aca369539a90b6978d0eb', // matches { production_start_time: new Date('2023-12-01T00:00:00.000Z'), production_end_time: new Date('2023-12-02T00:00:00.000Z'), energy_consumed_mwh: 2, commitment_salt: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }
    commitment_salt: null,
    energy_consumed_mwh: null,
    production_end_time: null,
    production_start_time: null,
  })

  return cert
}
