import { container } from 'tsyringe'

import { startStatusHandler } from './statusPoll'
import env from '../../env'
import Ipfs from '../ipfs'

const { WATCHER_POLL_PERIOD_MS, WATCHER_TIMEOUT_MS } = env

const ipfs = container.resolve(Ipfs)

const startIpfsStatus = () =>
  startStatusHandler({
    getStatus: ipfs.getStatus,
    pollingPeriodMs: WATCHER_POLL_PERIOD_MS,
    serviceTimeoutMs: WATCHER_TIMEOUT_MS,
  })

export default startIpfsStatus
