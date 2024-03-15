import { MockAgent, setGlobalDispatcher, getGlobalDispatcher, Dispatcher } from 'undici'
import { container } from 'tsyringe'

import { Env, ENV_KEYS } from '../../src/env.js'

export const selfAlias = 'test-self'
export const selfAddress = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'
export const notSelfAlias = 'test-not-self'
export const notSelfAddress = '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty'
export const regulatorAlias = 'test-regulator'
export const regulatorAddress = '5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y'

const env = container.resolve(Env)

export function withExternalServicesMock() {
  let originalDispatcher: Dispatcher
  let mockAgent: MockAgent
  beforeEach(function () {
    originalDispatcher = getGlobalDispatcher()
    mockAgent = new MockAgent()
    setGlobalDispatcher(mockAgent)
    const mockIdentity = mockAgent.get(`http://${env.get('IDENTITY_SERVICE_HOST')}:${env.get('IDENTITY_SERVICE_PORT')}`)
    mockIdentity
      .intercept({
        path: '/v1/self',
        method: 'GET',
      })
      .reply(200, {
        alias: selfAlias,
        address: selfAddress,
      })
      .persist()

    mockIdentity
      .intercept({
        path: `/v1/members/${selfAddress}`,
        method: 'GET',
      })
      .reply(200, {
        alias: selfAlias,
        address: selfAddress,
      })
      .persist()

    mockIdentity
      .intercept({
        path: `/v1/members/${notSelfAddress}`,
        method: 'GET',
      })
      .reply(200, {
        alias: notSelfAlias,
        address: notSelfAddress,
      })
      .persist()

    mockIdentity
      .intercept({
        path: `/v1/members/${notSelfAlias}`,
        method: 'GET',
      })
      .reply(200, {
        alias: notSelfAlias,
        address: notSelfAddress,
      })
      .persist()

    mockIdentity
      .intercept({
        path: `/v1/members/${regulatorAddress}`,
        method: 'GET',
      })
      .reply(200, {
        alias: regulatorAlias,
        address: regulatorAddress,
      })
      .persist()

    mockIdentity
      .intercept({
        path: `/v1/members/${regulatorAlias}`,
        method: 'GET',
      })
      .reply(200, {
        alias: regulatorAlias,
        address: regulatorAddress,
      })
      .persist()

    const mockCarbon = mockAgent.get(`https://api.carbonintensity.org.uk`)

    mockCarbon
      .intercept({
        path: '/intensity/2023-11-30T23:00:00.000Z/2023-12-02T00:00:00.000Z',
        method: 'GET',
      })
      .reply(200, {
        data: [
          {
            from: '2023-11-30T23:00:00.000Z',
            to: '2023-12-02T00:00:00.000Z',
            intensity: {
              actual: 123.456789123,
              forecast: 100,
              index: 'moderate',
            },
          },
        ],
      })
      .persist()
  })

  afterEach(function () {
    setGlobalDispatcher(originalDispatcher)
  })
}

export const withIpfsMock = (fileContent?: string | object | Buffer) => {
  let originalDispatcher: Dispatcher
  let mockAgent: MockAgent

  beforeEach(function () {
    originalDispatcher = getGlobalDispatcher()
    mockAgent = new MockAgent()
    setGlobalDispatcher(mockAgent)
    const mockIpfs = mockAgent.get(`http://${env.get('IPFS_HOST')}:${env.get('IPFS_PORT')}`)

    mockIpfs
      .intercept({
        path: '/api/v0/add?cid-version=0&wrap-with-directory=true',
        method: 'POST',
      })
      .reply(200, { Name: '', Hash: 'QmXVStDC6kTpVHY1shgBQmyA4SuSrYnNRnHSak5iB6Eehn', Size: '63052' })

    mockIpfs
      .intercept({
        path: '/api/v0/ls?arg=QmXVStDC6kTpVHY1shgBQmyA4SuSrYnNRnHSak5iB6Eehn',
        method: 'POST',
      })
      .reply(200, {
        Objects: [
          {
            Hash: 'file_hash',
            Links: [
              {
                Hash: 'file_hash',
                Name: 'test',
                Size: 42,
                Target: 'target',
                Type: 1,
              },
            ],
          },
        ],
      })
    if (fileContent) {
      mockIpfs
        .intercept({
          path: '/api/v0/cat?arg=file_hash',
          method: 'POST',
        })
        .reply(200, fileContent)
    }
  })

  afterEach(function () {
    setGlobalDispatcher(originalDispatcher)
  })
}

export const withIpfsMockError = () => {
  let originalDispatcher: Dispatcher
  let mockAgent: MockAgent

  beforeEach(function () {
    originalDispatcher = getGlobalDispatcher()
    mockAgent = new MockAgent()
    setGlobalDispatcher(mockAgent)
    const mockIpfs = mockAgent.get(`http://${env.get('IPFS_HOST')}:${env.get('IPFS_PORT')}`)

    mockIpfs
      .intercept({
        path: '/api/v0/add?cid-version=0&wrap-with-directory=true',
        method: 'POST',
      })
      .reply(500, 'error')
  })

  afterEach(function () {
    setGlobalDispatcher(originalDispatcher)
  })
}

export const mockEnv = (overrides: Partial<Record<ENV_KEYS, string>>): Env => {
  return {
    get<K extends ENV_KEYS>(key: K) {
      return overrides[key] || env.get(key)
    },
  } as Env
}
