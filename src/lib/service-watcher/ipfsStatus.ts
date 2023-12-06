import { container } from 'tsyringe'

import { startStatusHandler } from './statusPoll'
import Ipfs from '../ipfs'
import { Env } from '../../env'

const env = container.resolve(Env)
const ipfs = container.resolve(Ipfs)

const WATCHER_POLL_PERIOD_MS = env.get('WATCHER_POLL_PERIOD_MS')
const WATCHER_TIMEOUT_MS = env.get('WATCHER_TIMEOUT_MS')

const startIpfsStatus = () =>
  startStatusHandler({
    getStatus: ipfs.getStatus,
    pollingPeriodMs: WATCHER_POLL_PERIOD_MS,
    serviceTimeoutMs: WATCHER_TIMEOUT_MS,
  })

export default startIpfsStatus
