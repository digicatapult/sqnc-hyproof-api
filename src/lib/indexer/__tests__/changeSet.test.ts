import { describe, it } from 'mocha'
import { expect } from 'chai'

import { findIdTestSet } from './fixtures/changeSet'

import { AttachmentRecord, mergeChangeSets, findLocalIdInChangeSet } from '../changeSet'

const mkAttachment: (i: number) => AttachmentRecord = (i) => ({
  type: 'insert',
  id: `${i}`,
  ipfs_hash: `${i}-hash`,
})

describe('changeSet', function () {
  describe('mergeChangeSets', function () {
    it('should return undefined if neither base or update have entries', function () {
      const result = mergeChangeSets({}, {})
      expect(result).to.deep.equal({})
    })

    it('should return base if update is empty', function () {
      const base = {
        attachments: new Map([['123', mkAttachment(1)]]),
      }
      const result = mergeChangeSets(base, {})
      expect(result).to.deep.equal(base)
    })

    it('should return update if base is empty', function () {
      const update = {
        attachments: new Map([['123', mkAttachment(1)]]),
      }
      const result = mergeChangeSets({}, update)
      expect(result).to.deep.equal(update)
    })

    it('should include entries from base and update when keys are different', function () {
      const update = {
        attachments: new Map([['123', mkAttachment(1)]]),
      }
      const base = {
        attachments: new Map([['456', mkAttachment(2)]]),
      }
      const result = mergeChangeSets(base, update)
      expect(result).to.deep.equal({
        attachments: new Map([
          ['123', mkAttachment(1)],
          ['456', mkAttachment(2)],
        ]),
      })
    })

    it('should merge update onto base if entries exist in both', function () {
      const update = {
        attachments: new Map([['123', mkAttachment(1)]]),
      }
      const base = {
        attachments: new Map([['123', mkAttachment(2)]]),
      }
      const result = mergeChangeSets(base, update)
      expect(result).to.deep.equal({
        attachments: new Map([['123', mkAttachment(1)]]),
      })
    })
  })

  describe('findLocalIdInChangeSet', function () {
    it("returns null if it can't find tokenId", function () {
      const result = findLocalIdInChangeSet({}, 42)
      expect(result).to.equal(null)
    })

    it('should return id if token appears in certificates', function () {
      const result = findLocalIdInChangeSet(findIdTestSet, 42)
      expect(result).to.equal('0x02')
    })
  })
})
