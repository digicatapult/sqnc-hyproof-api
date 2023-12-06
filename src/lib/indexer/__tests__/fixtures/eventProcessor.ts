import { ChangeSet } from '../../changeSet'
import { EventProcessors } from '../../eventProcessor'
import sinon from 'sinon'

export const withMockEventProcessors: (result?: ChangeSet) => EventProcessors = (result: ChangeSet = {}) => ({
  initiate_cert: sinon.stub().returns(result),
  issue_cert: sinon.stub().returns(result),
})
