import sinon from 'sinon'
import ChainNode, { ProcessRanEvent } from '../../../chainNode'

export const events2: ProcessRanEvent[] = [
  {
    callHash: '0x0a',
    blockHash: '0x0b',
    sender: 'b',
    process: {
      id: 'c',
      version: 1,
    },
    inputs: [2],
    outputs: [3],
  },
  {
    callHash: '0x0c',
    blockHash: '0x0d',
    sender: 'e',
    process: {
      id: 'f',
      version: 4,
    },
    inputs: [5],
    outputs: [6],
  },
]

export const withHappyChainNode = () => {
  const getHeader = sinon.spy(async (hash: string) => {
    const number = parseInt(hash, 10)
    return Promise.resolve({
      hash: `${number}-hash`,
      height: number,
      parent: `${number - 1}-hash`,
    })
  })

  const getLastFinalisedBlockHash = sinon.stub().resolves('1-hash')

  return {
    getHeader,
    getLastFinalisedBlockHash,
  } as unknown as ChainNode
}

export const withGetHeaderBoom = (boomOnCallIndex: number) => {
  let callCount = 0
  const getHeader = sinon.spy(async (hash: string) => {
    if (callCount++ === boomOnCallIndex) {
      throw new Error('BOOM')
    }

    const number = parseInt(hash, 10)
    return Promise.resolve({
      hash: `${number}-hash`,
      height: number,
      parent: `${number - 1}-hash`,
    })
  })

  const getLastFinalisedBlockHash = sinon.stub().resolves('1-hash')

  return {
    getHeader,
    getLastFinalisedBlockHash,
  } as unknown as ChainNode
}

export const withProcessRanEvents = (events: ProcessRanEvent[]) => {
  return {
    getProcessRanEvents: sinon.stub().resolves(events),
  } as unknown as ChainNode
}

export const withGetTokenResponses = (blockHash: string, tokens: Set<number>) => {
  return {
    getToken: sinon.stub().callsFake((id: number, hash: string) =>
      Promise.resolve(
        hash === blockHash && tokens.has(id)
          ? {
              id,
              roles: new Map(),
              metadata: new Map(),
            }
          : null
      )
    ),
  } as unknown as ChainNode
}
