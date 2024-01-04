import { startStatusHandler } from './statusPoll'
import { Env } from '../../env'
import ChainNode from '../chainNode'

const startApiStatus = (env: Env, node: ChainNode) =>
  startStatusHandler({
    getStatus: node.getStatus,
    pollingPeriodMs: env.get('WATCHER_POLL_PERIOD_MS'),
    serviceTimeoutMs: env.get('WATCHER_TIMEOUT_MS'),
  })

export default startApiStatus
