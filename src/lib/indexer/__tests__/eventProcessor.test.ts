import { describe, it } from 'mocha'

import eventProcessors from '../eventProcessor'
import { expect } from 'chai'
import { TransactionRow } from '../../db'

describe('eventProcessor', function () {
  describe('example-create', function () {
    it('should error with version != 1', function () {
      let error: Error | null = null
      try {
        eventProcessors['example-create'](0, null, 'alice', [], [])
      } catch (err) {
        error = err instanceof Error ? err : null
      }
      expect(error).instanceOf(Error)
    })

    it('should return update to example if transaction exists', function () {
      const result = eventProcessors['example-create'](
        1,
        { localId: '42' } as TransactionRow,
        'alice',
        [],
        [{ id: 1, roles: new Map(), metadata: new Map() }]
      )

      expect(result).to.deep.equal({
        examples: new Map([
          ['42', { type: 'update', id: '42', state: 'created', latest_token_id: 1, original_token_id: 1 }],
        ]),
      })
    })

    it("should return new attachment and example if transaction doesn't exist", function () {
      const result = eventProcessors['example-create'](
        1,
        null,
        'alice',
        [],
        [
          {
            id: 1,
            roles: new Map([['owner', '123']]),
            metadata: new Map([
              ['parameters', 'a'],
              ['subtype', 'example_a'],
            ]),
          },
        ]
      )

      expect(result.attachments?.size).to.equal(1)
      const [[attachmentId, attachment]] = [...(result.attachments || [])]
      expect(attachment).to.deep.equal({
        type: 'insert',
        id: attachmentId,
        ipfs_hash: 'a',
      })
    })
  })
})
