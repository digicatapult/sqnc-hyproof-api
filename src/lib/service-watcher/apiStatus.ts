import { startStatusHandler } from './statusPoll.js'
import { Env } from '../../env.js'
import ChainNode from '../chainNode.js'

const startApiStatus = (env: Env, node: ChainNode) =>
  startStatusHandler({
    getStatus: node.getStatus,
    pollingPeriodMs: env.get('WATCHER_POLL_PERIOD_MS'),
    serviceTimeoutMs: env.get('WATCHER_TIMEOUT_MS'),
  })

export default startApiStatus
