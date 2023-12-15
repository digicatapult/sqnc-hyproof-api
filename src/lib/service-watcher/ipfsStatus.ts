import { startStatusHandler } from './statusPoll'
import Ipfs from '../ipfs'
import { Env } from '../../env'

const startIpfsStatus = (env: Env, ipfs: Ipfs) =>
  startStatusHandler({
    getStatus: ipfs.getStatus,
    pollingPeriodMs: env.get('WATCHER_POLL_PERIOD_MS'),
    serviceTimeoutMs: env.get('WATCHER_TIMEOUT_MS'),
  })

export default startIpfsStatus
