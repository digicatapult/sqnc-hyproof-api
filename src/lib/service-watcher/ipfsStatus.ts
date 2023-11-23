import { startStatusHandler } from './statusPoll'
import env from '../../env'
import Ipfs from '../ipfs'
import { logger } from '../logger'

const { WATCHER_POLL_PERIOD_MS, WATCHER_TIMEOUT_MS } = env

const ipfs = new Ipfs({ host: env.IPFS_HOST, port: env.IPFS_PORT, logger })

const startIpfsStatus = () =>
  startStatusHandler({
    getStatus: ipfs.getStatus,
    pollingPeriodMs: WATCHER_POLL_PERIOD_MS,
    serviceTimeoutMs: WATCHER_TIMEOUT_MS,
  })

export default startIpfsStatus
