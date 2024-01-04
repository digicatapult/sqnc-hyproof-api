import { startStatusHandler } from './statusPoll'
import { Env } from '../../env'
import Identity from '../services/identity'

const startIdentityStatus = (env: Env, identity: Identity) =>
  startStatusHandler({
    getStatus: identity.getStatus.bind(identity),
    pollingPeriodMs: env.get('WATCHER_POLL_PERIOD_MS'),
    serviceTimeoutMs: env.get('WATCHER_TIMEOUT_MS'),
  })

export default startIdentityStatus
