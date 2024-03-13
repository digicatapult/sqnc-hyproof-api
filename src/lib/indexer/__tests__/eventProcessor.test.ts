import { describe, it } from 'mocha'
import { expect } from 'chai'

import eventProcessors from '../eventProcessor.js'
import { TransactionRow } from '../../db/types.js'

describe('eventProcessor', function () {
  describe('initiate_cert', function () {
    it('should error with version != 1', function () {
      let error: Error | null = null
      try {
        eventProcessors['initiate_cert']({ version: 0, sender: 'alice', inputs: [], outputs: [] })
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
        inputs: [],
        outputs: [{ id: 1, roles: new Map(), metadata: new Map() }],
      })

      expect(result).to.deep.equal({
        certificates: new Map([
          ['42', { type: 'update', id: '42', state: 'initiated', latest_token_id: 1, original_token_id: 1 }],
        ]),
      })
    })

    it("should return new certificate if transaction doesn't exist", function () {
      const result = eventProcessors['initiate_cert']({
        version: 1,
        sender: 'alice',
        inputs: [],
        outputs: [
          {
            id: 1,
            roles: new Map([
              ['hydrogen_owner', 'heidi-hydrogen-producer'],
              ['energy_owner', 'emma-energy-producer'],
              ['regulator', 'reginald-regulator'],
            ]),
            metadata: new Map([
              ['hydrogen_quantity_wh', '42000000'],
              ['commitment', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
            ]),
          },
        ],
      })

      const [[, certificate]] = [...(result.certificates || [])]
      expect(certificate).to.deep.contain({
        type: 'insert',
        hydrogen_owner: 'heidi-hydrogen-producer',
        energy_owner: 'emma-energy-producer',
        state: 'initiated',
        hydrogen_quantity_wh: '42000000',
        latest_token_id: 1,
        original_token_id: 1,
        commitment: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      })
    })

    it("should return new certificate if transaction doesn't exist", function () {
      let error: Error | null = null
      try {
        eventProcessors['initiate_cert']({
          version: 1,
          sender: 'alice',
          inputs: [],
          outputs: [
            {
              id: 1,
              roles: new Map([
                ['hydrogen_owner', 'heidi-hydrogen-producer'],
                ['energy_owner', 'emma-emma-producer'],
                ['regulator', 'reginald-regulator'],
              ]),
              metadata: new Map([['hydrogen_quantity_wh', 'not a number']]),
            },
          ],
        })
      } catch (err) {
        error = err instanceof Error ? err : null
      }
      expect(error).instanceOf(Error)
    })
  })

  describe('issue_cert', function () {
    it('should error with version != 1', function () {
      let error: Error | null = null
      try {
        eventProcessors['issue_cert']({ version: 0, sender: 'alice', inputs: [], outputs: [] })
      } catch (err) {
        error = err instanceof Error ? err : null
      }
      expect(error).instanceOf(Error)
    })

    it('should update the certificate', function () {
      const result = eventProcessors['issue_cert']({
        version: 1,
        sender: 'alice',
        inputs: [{ id: 1, local_id: 'caa699b7-b0b6-4e0e-ac15-698b7b1f6541' }],
        outputs: [
          {
            id: 2,
            metadata: new Map([['embodied_co2', '42']]),
            roles: new Map(),
          },
        ],
      })

      expect(result).to.deep.equal({
        certificates: new Map([
          [
            'caa699b7-b0b6-4e0e-ac15-698b7b1f6541',
            {
              id: 'caa699b7-b0b6-4e0e-ac15-698b7b1f6541',
              type: 'update',
              latest_token_id: 2,
              state: 'issued',
              embodied_co2: '42',
            },
          ],
        ]),
      })
    })

    it('should throw if embodied_co2 is missing', function () {
      let error: Error | null = null
      try {
        eventProcessors['issue_cert']({
          version: 1,
          sender: 'alice',
          inputs: [{ id: 1, local_id: 'caa699b7-b0b6-4e0e-ac15-698b7b1f6541' }],
          outputs: [
            {
              id: 2,
              metadata: new Map([]),
              roles: new Map(),
            },
          ],
        })
      } catch (e) {
        if (e instanceof Error) error = e
      }
      expect(error).to.empty.instanceOf(Error)
    })

    it('should throw if embodied_co2 is not a number', function () {
      let error: Error | null = null
      try {
        eventProcessors['issue_cert']({
          version: 1,
          sender: 'alice',
          inputs: [{ id: 1, local_id: 'caa699b7-b0b6-4e0e-ac15-698b7b1f6541' }],
          outputs: [
            {
              id: 2,
              metadata: new Map([['embodied_co2', 'string']]),
              roles: new Map(),
            },
          ],
        })
      } catch (e) {
        if (e instanceof Error) error = e
      }
      expect(error).to.empty.instanceOf(Error)
    })
  })

  describe('revoke_cert', function () {
    it('should error with version != 1', function () {
      let error: Error | null = null
      try {
        eventProcessors['revoke_cert']({ version: 0, sender: 'alice', inputs: [], outputs: [] })
      } catch (err) {
        error = err instanceof Error ? err : null
      }
      expect(error).instanceOf(Error)
    })

    it('should update without attachment if transaction is present', function () {
      const result = eventProcessors['revoke_cert']({
        version: 1,
        sender: 'alice',
        transaction: { local_id: '42' } as TransactionRow,
        inputs: [{ id: 1, local_id: 'caa699b7-b0b6-4e0e-ac15-698b7b1f6541' }],
        outputs: [
          {
            id: 2,
            metadata: new Map([['reason', '90234681-8808-4eaa-ac65-c643c22e3524']]),
            roles: new Map(),
          },
        ],
      })

      expect(result).to.deep.equal({
        certificates: new Map([
          [
            'caa699b7-b0b6-4e0e-ac15-698b7b1f6541',
            {
              id: 'caa699b7-b0b6-4e0e-ac15-698b7b1f6541',
              type: 'update',
              latest_token_id: 2,
              state: 'revoked',
              revocation_reason: '90234681-8808-4eaa-ac65-c643c22e3524',
            },
          ],
        ]),
      })
    })

    it('should update with attachment if transaction is not present', function () {
      const result = eventProcessors['revoke_cert']({
        version: 1,
        sender: 'alice',
        inputs: [{ id: 1, local_id: 'caa699b7-b0b6-4e0e-ac15-698b7b1f6541' }],
        outputs: [
          {
            id: 2,
            metadata: new Map([['reason', 'QmXVStDC6kTpVHY1shgBQmyA4SuSrYnNRnHSak5iB6Eehn']]),
            roles: new Map(),
          },
        ],
      })

      const attachmentId = result.attachments?.keys().next().value
      expect(attachmentId).to.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)

      expect(result).to.deep.equal({
        attachments: new Map([
          [
            attachmentId,
            {
              type: 'insert',
              id: attachmentId,
              filename: null,
              size: null,
              ipfs_hash: 'QmXVStDC6kTpVHY1shgBQmyA4SuSrYnNRnHSak5iB6Eehn',
            },
          ],
        ]),
        certificates: new Map([
          [
            'caa699b7-b0b6-4e0e-ac15-698b7b1f6541',
            {
              id: 'caa699b7-b0b6-4e0e-ac15-698b7b1f6541',
              type: 'update',
              latest_token_id: 2,
              state: 'revoked',
              revocation_reason: attachmentId,
            },
          ],
        ]),
      })
    })
  })
})
