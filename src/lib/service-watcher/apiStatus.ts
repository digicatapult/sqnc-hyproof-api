import { container } from 'tsyringe'

import { startStatusHandler } from './statusPoll'
import env from '../../env'
import ChainNode from '../chainNode'

const { WATCHER_POLL_PERIOD_MS, WATCHER_TIMEOUT_MS } = env
const node = container.resolve(ChainNode)

const startApiStatus = () =>
  startStatusHandler({
    getStatus: node.getStatus,
    pollingPeriodMs: WATCHER_POLL_PERIOD_MS,
    serviceTimeoutMs: WATCHER_TIMEOUT_MS,
  })

export default startApiStatus
