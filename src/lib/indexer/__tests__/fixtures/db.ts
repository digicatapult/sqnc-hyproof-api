import sinon from 'sinon'
import Database from '../../../db'

type LastProcessBlockResult = { hash: string; parent: string; height: number } | null

export const withLastProcessedBlocksByCall = (calls: LastProcessBlockResult[][]) => {
  let getMock = sinon.stub().resolves(calls.at(-1))
  for (let i = 0; i < calls.length; i++) {
    getMock = getMock.onCall(i).resolves(calls[i])
  }

  const insert = sinon.stub().resolves()

  const self = {
    get: getMock,
    withTransaction: sinon.spy(async function (fn: (db: Database) => Promise<void>) {
      await fn({
        insert,
      } as unknown as Database)
    }),
  } as unknown as Database

  return self
}

export const withInitialLastProcessedBlock = (initial: LastProcessBlockResult) => {
  let lastBlock: LastProcessBlockResult = initial
  const getMock = sinon.spy(() => Promise.resolve([lastBlock]))

  const insert = sinon.spy((table: string, block: LastProcessBlockResult) => {
    if (table === 'processed_blocks') lastBlock = block
    return Promise.resolve()
  })

  const update = sinon.stub().resolves()

  return {
    get: getMock,
    update,
    insert,
    withTransaction: sinon.spy(async function (fn: (db: Database) => Promise<void>) {
      await fn({
        insert,
        update,
      } as unknown as Database)
    }),
  } as unknown as Database
}

export const withTransactionMatchingTokensInDb = (tx: null | object, tokens: Map<number, string | null>) => {
  return {
    get: sinon.stub().callsFake((table, { latest_token_id }) => {
      if (table === 'transaction') return Promise.resolve([tx])
      else return Promise.resolve([{ id: tokens.get(latest_token_id) }])
    }),
  } as unknown as Database
}
