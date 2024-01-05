import { describe, it } from 'mocha'
import { expect } from 'chai'

import Commitment from '../commitment.js'
import type { ALGOS } from '../commitment.js'

describe('Commitment', function () {
  describe('ctor', function () {
    it('should validate and store block size for valid algorithm', function () {
      const commitment = new Commitment('shake128')
      expect(commitment.algo).to.equal('shake128')
      expect(commitment.blockSize).to.equal(128)
    })

    it('should error if hash algorithm is unsupported by system', function () {
      let error: Error | null = null
      try {
        new Commitment('unsupported' as ALGOS)
      } catch (err) {
        if (err instanceof Error) {
          error = err
        }
      }
      expect(error).instanceOf(Error)
    })
  })

  describe('build', function () {
    it('should build a salt and digest for a string record', async function () {
      const commitment = new Commitment('sha256')
      const result = await commitment.build({ foo: 'bar' })

      expect(result.salt).to.match(/^[0-9a-f]{64}$/)
      expect(result.digest).to.match(/^[0-9a-f]{64}$/)
    })

    it('should build a salt and digest with shake128', async function () {
      const commitment = new Commitment('shake128')
      const result = await commitment.build({ foo: 'bar' })

      expect(result.salt).to.match(/^[0-9a-f]{32}$/)
      expect(result.digest).to.match(/^[0-9a-f]{32}$/)
    })

    it('should build a salt and digest with shake256', async function () {
      const commitment = new Commitment('shake256')
      const result = await commitment.build({ foo: 'bar' })

      expect(result.salt).to.match(/^[0-9a-f]{64}$/)
      expect(result.digest).to.match(/^[0-9a-f]{64}$/)
    })

    it('should build a salt and digest for a number record', async function () {
      const commitment = new Commitment('sha256')
      const result = await commitment.build({ foo: 42 })

      expect(result.salt).to.match(/^[0-9a-f]{64}$/)
      expect(result.digest).to.match(/^[0-9a-f]{64}$/)
    })

    it('should build a salt and digest for a Date record', async function () {
      const commitment = new Commitment('sha256')
      const result = await commitment.build({ foo: new Date() })

      expect(result.salt).to.match(/^[0-9a-f]{64}$/)
      expect(result.digest).to.match(/^[0-9a-f]{64}$/)
    })

    it('should build a salt and digest for multiple records', async function () {
      const commitment = new Commitment('sha256')
      const result = await commitment.build({ a: 'foo', b: 42, c: new Date() })

      expect(result.salt).to.match(/^[0-9a-f]{64}$/)
      expect(result.digest).to.match(/^[0-9a-f]{64}$/)
    })
  })

  for (const algo of ['sha256', 'shake128', 'shake256'] as const) {
    describe(`validate (${algo})`, function () {
      it('should validate like records', async function () {
        const record = { a: 'foo', b: 42, c: new Date() }
        const commitment = new Commitment(algo)

        const { salt, digest } = await commitment.build(record)
        const result = commitment.validate(record, salt, digest)
        expect(result).to.equal(true)
      })

      it('should validate like re-ordered records', async function () {
        const record = { a: 'foo', b: 42, c: new Date() }
        const record2 = { b: 42, c: new Date(), a: 'foo' }
        const commitment = new Commitment(algo)

        const { salt, digest } = await commitment.build(record)
        const result = commitment.validate(record2, salt, digest)
        expect(result).to.equal(true)
      })

      it('should not validate for unlike records (missing prop)', async function () {
        const record = { a: 'foo', b: 42, c: new Date() }
        const record2 = { a: 'foo', b: 42 }
        const commitment = new Commitment(algo)

        const { salt, digest } = await commitment.build(record)
        const result = commitment.validate(record2, salt, digest)
        expect(result).to.equal(false)
      })

      it('should not validate for unlike records (additional prop)', async function () {
        const record = { a: 'foo', b: 42, c: new Date() }
        const record2 = { ...record, d: 'bar' }
        const commitment = new Commitment(algo)

        const { salt, digest } = await commitment.build(record)
        const result = commitment.validate(record2, salt, digest)
        expect(result).to.equal(false)
      })

      it('should not validate for unlike records (string prop)', async function () {
        const record = { a: 'foo', b: 42, c: new Date() }
        const record2 = { ...record, a: 'bar' }
        const commitment = new Commitment(algo)

        const { salt, digest } = await commitment.build(record)
        const result = commitment.validate(record2, salt, digest)
        expect(result).to.equal(false)
      })

      it('should not validate for unlike records (number prop)', async function () {
        const record = { a: 'foo', b: 42, c: new Date() }
        const record2 = { ...record, b: 1 }
        const commitment = new Commitment(algo)

        const { salt, digest } = await commitment.build(record)
        const result = commitment.validate(record2, salt, digest)
        expect(result).to.equal(false)
      })

      it('should not validate for unlike records (date prop)', async function () {
        const record = { a: 'foo', b: 42, c: new Date() }
        const record2 = { ...record, c: new Date(0) }
        const commitment = new Commitment(algo)

        const { salt, digest } = await commitment.build(record)
        const result = commitment.validate(record2, salt, digest)
        expect(result).to.equal(false)
      })

      it('should not validate with incorrect salt', async function () {
        const record = { a: 'foo', b: 42, c: new Date() }
        const commitment = new Commitment(algo)

        const { digest } = await commitment.build(record)
        const result = commitment.validate(
          record,
          algo === 'shake128' ? 'aaaaaaaaaaaaaaaa' : 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          digest
        )
        expect(result).to.equal(false)
      })
    })
  }
})
