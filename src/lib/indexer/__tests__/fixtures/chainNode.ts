import sinon from 'sinon'
import ChainNode, { ProcessRanEvent } from '../../../chainNode.js'
import { HEX } from '../../../../models/strings.js'

export const events2: ProcessRanEvent[] = [
  {
    callHash: '0x0a',
    blockHash: '0x0b',
    blockTime: new Date('2024-01-01'),
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
    blockTime: new Date('2024-01-02'),
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
  const getHeader = sinon.spy(async (hash: HEX) => {
    const number = parseInt(hash.substring(2), 10)
    return Promise.resolve({
      hash: `0x${number}-hash`,
      height: number,
      parent: `0x${number - 1}-hash`,
    })
  })

  const getLastFinalisedBlockHash = sinon.stub().resolves('0x1-hash')

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

    const number = parseInt(hash.substring(2), 10)
    return Promise.resolve({
      hash: `0x${number}-hash`,
      height: number,
      parent: `0x${number - 1}-hash`,
    })
  })

  const getLastFinalisedBlockHash = sinon.stub().resolves('0x1-hash')

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
