import { singleton } from 'tsyringe'
import startApiStatus from './apiStatus'
import startIpfsStatus from './ipfsStatus'
import startIdentityStatus from './identityStatus'
import { buildCombinedHandler, SERVICE_STATE, Status } from './statusPoll'

@singleton()
export class ServiceWatcher {
  handlersP: Promise<{
    readonly status: SERVICE_STATE
    readonly detail: {
      [k: string]: Status
    }
    close: () => void
  }>

  constructor() {
    this.handlersP = this.build()
  }

  private build = async (): Promise<{
    readonly status: SERVICE_STATE
    readonly detail: {
      [k: string]: Status
    }
    close: () => void
  }> => {
    const handlers = new Map()
    const [apiStatus, ipfsStatus, identityStatus] = await Promise.all([
      startApiStatus(),
      startIpfsStatus(),
      startIdentityStatus(),
    ])
    handlers.set('api', apiStatus)
    handlers.set('ipfs', ipfsStatus)
    handlers.set('identity', identityStatus)

    return buildCombinedHandler(handlers)
  }

  public get status(): Promise<SERVICE_STATE> {
    return this.handlersP.then(({ status }) => status)
  }

  public get detail() {
    return this.handlersP.then(({ detail }) => detail)
  }

  public async close() {
    const handlers = await this.handlersP
    handlers.close()
  }
}
