import { injectable, singleton } from 'tsyringe'

import startApiStatus from './apiStatus.js'
import startIpfsStatus from './ipfsStatus.js'
import startIdentityStatus from './identityStatus.js'
import { buildCombinedHandler, SERVICE_STATE, Status } from './statusPoll.js'

import { Env } from '../../env.js'
import ChainNode from '../chainNode.js'
import Identity from '../services/identity.js'
import Ipfs from '../ipfs.js'

@singleton()
@injectable()
export class ServiceWatcher {
  handlersP: Promise<{
    readonly status: SERVICE_STATE
    readonly detail: {
      [k: string]: Status
    }
    close: () => void
  }>

  constructor(
    private env: Env,
    private node: ChainNode,
    private identity: Identity,
    private ipfs: Ipfs
  ) {
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
      startApiStatus(this.env, this.node),
      startIpfsStatus(this.env, this.ipfs),
      startIdentityStatus(this.env, this.identity),
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
