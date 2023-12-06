import { container } from 'tsyringe'

import { startStatusHandler } from './statusPoll'
import { Env } from '../../env'
import Identity from '../services/identity'

const env = container.resolve(Env)

const WATCHER_POLL_PERIOD_MS = env.get('WATCHER_POLL_PERIOD_MS')
const WATCHER_TIMEOUT_MS = env.get('WATCHER_TIMEOUT_MS')

const identity = container.resolve(Identity)

const startIdentityStatus = () =>
  startStatusHandler({
    getStatus: identity.getStatus.bind(identity),
    pollingPeriodMs: WATCHER_POLL_PERIOD_MS,
    serviceTimeoutMs: WATCHER_TIMEOUT_MS,
  })

export default startIdentityStatus
