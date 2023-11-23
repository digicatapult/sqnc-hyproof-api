import { NotFound, HttpResponse } from '../error-handler'
import env from '../../env'
import { Status, serviceState } from '../service-watcher/statusPoll'
import { singleton } from 'tsyringe'

const URL_PREFIX = `http://${env.IDENTITY_SERVICE_HOST}:${env.IDENTITY_SERVICE_PORT}`

@singleton()
export default class Identity {
  constructor() {}

  getStatus = async (): Promise<Status> => {
    try {
      const res = await this.getHealth()
      if (res) {
        if (!res.version.match(/\d+.\d+.\d+/)) {
          return {
            status: serviceState.DOWN,
            detail: {
              message: 'Error getting status from Identity service',
            },
          }
        }
        return {
          status: serviceState.UP,
          detail: {
            version: res.version,
          },
        }
      }
      throw new Error()
    } catch (err) {
      return {
        status: serviceState.DOWN,
        detail: {
          message: 'Error getting status from Identity service',
        },
      }
    }
  }
  getMemberByAlias = async (alias: string) => {
    const res = await fetch(`${URL_PREFIX}/v1/members/${encodeURIComponent(alias)}`)

    if (res.ok) {
      return await res.json()
    }

    if (res.status === 404) {
      throw new NotFound(`identity: ${alias}`)
    }

    throw new HttpResponse({})
  }

  getHealth = async () => {
    const res = await fetch(`${URL_PREFIX}/health`)

    if (res.ok) {
      return await res.json()
    }

    throw new HttpResponse({})
  }

  getMemberBySelf = async () => {
    const res = await fetch(`${URL_PREFIX}/v1/self`)

    if (res.ok) {
      return await res.json()
    }

    throw new HttpResponse({})
  }

  getMemberByAddress = (alias: string) => this.getMemberByAlias(alias)
}
