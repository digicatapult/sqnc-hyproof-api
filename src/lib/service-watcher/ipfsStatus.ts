import { startStatusHandler } from './statusPoll.js'
import Ipfs from '../ipfs.js'
import { Env } from '../../env.js'

const startIpfsStatus = (env: Env, ipfs: Ipfs) =>
  startStatusHandler({
    getStatus: ipfs.getStatus,
    pollingPeriodMs: env.get('WATCHER_POLL_PERIOD_MS'),
    serviceTimeoutMs: env.get('WATCHER_TIMEOUT_MS'),
  })

export default startIpfsStatus
