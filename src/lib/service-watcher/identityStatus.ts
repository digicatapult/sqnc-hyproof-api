import { startStatusHandler } from './statusPoll'
import env from '../../env'
import Identity from '../services/identity'

const { WATCHER_POLL_PERIOD_MS, WATCHER_TIMEOUT_MS } = env

const identity = new Identity()

const startIdentityStatus = () =>
  startStatusHandler({
    getStatus: identity.getStatus.bind(identity),
    pollingPeriodMs: WATCHER_POLL_PERIOD_MS,
    serviceTimeoutMs: WATCHER_TIMEOUT_MS,
  })

export default startIdentityStatus
