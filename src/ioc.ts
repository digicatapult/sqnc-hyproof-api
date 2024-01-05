import { IocContainer } from '@tsoa/runtime'
import { container } from 'tsyringe'

import Commitment from './lib/services/commitment.js'
import Database from './lib/db/index.js'

container.register(Commitment, { useValue: new Commitment('shake128') })
container.register(Database, { useValue: new Database() })

export const iocContainer: IocContainer = {
  get: <T>(controller: { prototype: T }): T => {
    return container.resolve<T>(controller as never)
  },
}
