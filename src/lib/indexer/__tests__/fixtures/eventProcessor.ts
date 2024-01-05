import sinon from 'sinon'

import { ChangeSet } from '../../changeSet.js'
import { EventProcessors } from '../../eventProcessor.js'

export const withMockEventProcessors: (result?: ChangeSet) => EventProcessors = (result: ChangeSet = {}) => ({
  initiate_cert: sinon.stub().returns(result),
  issue_cert: sinon.stub().returns(result),
  revoke_cert: sinon.stub().returns(result),
})
