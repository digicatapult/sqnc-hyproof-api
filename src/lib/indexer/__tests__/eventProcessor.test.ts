import { describe, it } from 'mocha'

import eventProcessors from '../eventProcessor'
import { expect } from 'chai'
import { TransactionRow } from '../../db'

describe('eventProcessor', function () {
  describe('process_initiate_cert', function () {
    it('should error with version != 1', function () {
      let error: Error | null = null
      try {
        eventProcessors['process_initiate_cert'](0, null, 'alice', [], [])
      } catch (err) {
        error = err instanceof Error ? err : null
      }
      expect(error).instanceOf(Error)
    })

    it('should return update to certificate if transaction exists', function () {
      const result = eventProcessors['process_initiate_cert'](
        1,
        { localId: '42' } as TransactionRow,
        'alice',
        [],
        [{ id: 1, roles: new Map(), metadata: new Map() }]
      )

      expect(result).to.deep.equal({
        certificates: new Map([
          ['42', { type: 'update', id: '42', state: 'created', latest_token_id: 1, original_token_id: 1 }],
        ]),
      })
    })

    it("should return new certificate if transaction doesn't exist", function () {
      const result = eventProcessors['process_initiate_cert'](
        1,
        null,
        'alice',
        [],
        [
          {
            id: 1,
            roles: new Map([['owner', 'heidi-hydrogen-producer']]),
            metadata: new Map([
              ['parameters', 'a'],
              ['co2e', '10'],
              ['capacity', '1'],
            ]),
          },
        ]
      )

      const [[, certificate]] = [...(result.certificates || [])]
      expect(certificate).to.deep.contain({
        type: 'insert',
        owner: 'heidi-hydrogen-producer',
        state: 'initialized',
        co2e: '10',
        capacity: '1',
        latest_token_id: 1,
        original_token_id: 1,
        parameters_attachment_id: '',
      })
    })
  })
})
