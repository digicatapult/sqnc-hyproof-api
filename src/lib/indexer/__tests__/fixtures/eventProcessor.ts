import { ChangeSet } from '../../changeSet'
import { EventProcessors } from '../../eventProcessor'
import sinon from 'sinon'

export const withMockEventProcessors: (result?: ChangeSet) => EventProcessors = (result: ChangeSet = {}) => ({
  'example-create': sinon.stub().returns(result),
})
