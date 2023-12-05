import { IocContainer } from '@tsoa/runtime'
import { container } from 'tsyringe'

import Commitment from './lib/services/commitment'
import Database from './lib/db'

container.register(Commitment, { useValue: new Commitment('shake128') })
container.register(Database, { useValue: new Database() })

export const iocContainer: IocContainer = {
  get: <T>(controller: { prototype: T }): T => {
    return container.resolve<T>(controller as never)
  },
}
