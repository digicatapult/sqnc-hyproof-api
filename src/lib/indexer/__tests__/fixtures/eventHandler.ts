import sinon from 'sinon'

import { ChangeSet } from '../../changeSet.js'
import EventHandler from '../../handleEvent.js'

export const withMockEventHandler = (changeSets: ChangeSet[]) => {
  return {
    handleEvent: sinon.stub().onFirstCall().resolves(changeSets[0]).onSecondCall().resolves(changeSets[1]),
  } as unknown as EventHandler
}
