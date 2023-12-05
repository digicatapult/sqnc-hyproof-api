import { IocContainer } from '@tsoa/runtime'
import { container } from 'tsyringe'

import Database from './lib/db'

container.register(Database, { useValue: new Database() })

export const iocContainer: IocContainer = {
  get: <T>(controller: { prototype: T }): T => {
    return container.resolve<T>(controller as never)
  },
}
