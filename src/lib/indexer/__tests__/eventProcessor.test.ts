import { describe, it } from 'mocha'

import eventProcessors from '../eventProcessor'
import { expect } from 'chai'
import { TransactionRow } from '../../db'

describe('eventProcessor', function () {
  describe('initiate_cert', function () {
    it('should error with version != 1', function () {
      let error: Error | null = null
      try {
        eventProcessors['initiate_cert']({ version: 0, sender: 'alice', outputs: [] })
      } catch (err) {
        error = err instanceof Error ? err : null
      }
      expect(error).instanceOf(Error)
    })

    it('should return update to certificate if transaction exists', function () {
      const result = eventProcessors['initiate_cert']({
        version: 1,
        transaction: { local_id: '42' } as TransactionRow,
        sender: 'alice',
        outputs: [{ id: 1, roles: new Map(), metadata: new Map() }],
      })

      expect(result).to.deep.equal({
        certificates: new Map([
          ['42', { type: 'update', id: '42', state: 'created', latest_token_id: 1, original_token_id: 1 }],
        ]),
      })
    })

    it("should return new certificate if transaction doesn't exist", function () {
      const result = eventProcessors['initiate_cert']({
        version: 1,
        sender: 'alice',
        outputs: [
          {
            id: 1,
            roles: new Map([
              ['hydrogen_owner', 'heidi-hydrogen-producer'],
              ['energy_owner', 'emma-energy-producer'],
            ]),
            metadata: new Map([['hydrogen_quantity_mwh', '42']]),
          },
        ],
      })

      const [[, certificate]] = [...(result.certificates || [])]
      expect(certificate).to.deep.contain({
        type: 'insert',
        hydrogen_owner: 'heidi-hydrogen-producer',
        energy_owner: 'emma-energy-producer',
        state: 'created',
        hydrogen_quantity_mwh: 42,
        latest_token_id: 1,
        original_token_id: 1,
      })
    })

    it("should return new certificate if transaction doesn't exist", function () {
      let error: Error | null = null
      try {
        eventProcessors['initiate_cert']({
          version: 1,
          sender: 'alice',
          outputs: [
            {
              id: 1,
              roles: new Map([
                ['hydrogen_owner', 'heidi-hydrogen-producer'],
                ['energy_owner', 'emma-emma-producer'],
              ]),
              metadata: new Map([['hydrogen_quantity_mwh', 'not a number']]),
            },
          ],
        })
      } catch (err) {
        error = err instanceof Error ? err : null
      }
      expect(error).instanceOf(Error)
    })
  })
})
