import { container } from 'tsyringe'

import { startStatusHandler } from './statusPoll'
import { Env } from '../../env'
import ChainNode from '../chainNode'

const env = container.resolve(Env)
const node = container.resolve(ChainNode)

const WATCHER_POLL_PERIOD_MS = env.get('WATCHER_POLL_PERIOD_MS')
const WATCHER_TIMEOUT_MS = env.get('WATCHER_TIMEOUT_MS')

const startApiStatus = () =>
  startStatusHandler({
    getStatus: node.getStatus,
    pollingPeriodMs: WATCHER_POLL_PERIOD_MS,
    serviceTimeoutMs: WATCHER_TIMEOUT_MS,
  })

export default startApiStatus
