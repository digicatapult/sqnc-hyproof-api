import { startStatusHandler } from './statusPoll'
import env from '../../env'
import ChainNode from '../chainNode'
import { logger } from '../logger'

const { WATCHER_POLL_PERIOD_MS, WATCHER_TIMEOUT_MS } = env
const node = new ChainNode({
  host: env.NODE_HOST,
  port: env.NODE_PORT,
  logger,
  userUri: env.USER_URI,
})

const startApiStatus = () =>
  startStatusHandler({
    getStatus: node.getStatus,
    pollingPeriodMs: WATCHER_POLL_PERIOD_MS,
    serviceTimeoutMs: WATCHER_TIMEOUT_MS,
  })

export default startApiStatus
