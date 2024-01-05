import { injectable, singleton } from 'tsyringe'
import { z } from 'zod'

import { NotFound, HttpResponse } from '../error-handler/index.js'
import { Status, serviceState } from '../service-watcher/statusPoll.js'
import { Env } from '../../env.js'

const identityResponseValidator = z.object({
  address: z.string(),
  alias: z.string(),
})
type IdentityResponse = z.infer<typeof identityResponseValidator>

@singleton()
@injectable()
export default class Identity {
  private URL_PREFIX: string

  constructor(private env: Env) {
    this.URL_PREFIX = `http://${this.env.get('IDENTITY_SERVICE_HOST')}:${this.env.get('IDENTITY_SERVICE_PORT')}`
  }

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
  getMemberByAlias = async (alias: string): Promise<IdentityResponse> => {
    const res = await fetch(`${this.URL_PREFIX}/v1/members/${encodeURIComponent(alias)}`)

    if (res.ok) {
      return identityResponseValidator.parse(await res.json())
    }

    if (res.status === 404) {
      throw new NotFound(`identity: ${alias}`)
    }

    throw new HttpResponse({})
  }

  getHealth = async () => {
    const res = await fetch(`${this.URL_PREFIX}/health`)

    if (res.ok) {
      return await res.json()
    }

    throw new HttpResponse({})
  }

  getMemberBySelf = async (): Promise<IdentityResponse> => {
    const res = await fetch(`${this.URL_PREFIX}/v1/self`)

    if (res.ok) {
      return identityResponseValidator.parse(await res.json())
    }

    throw new HttpResponse({})
  }

  getMemberByAddress = (alias: string) => this.getMemberByAlias(alias)
}
