import { startStatusHandler } from './statusPoll.js'
import { Env } from '../../env.js'
import Identity from '../services/identity.js'

const startIdentityStatus = (env: Env, identity: Identity) =>
  startStatusHandler({
    getStatus: identity.getStatus.bind(identity),
    pollingPeriodMs: env.get('WATCHER_POLL_PERIOD_MS'),
    serviceTimeoutMs: env.get('WATCHER_TIMEOUT_MS'),
  })

export default startIdentityStatus
