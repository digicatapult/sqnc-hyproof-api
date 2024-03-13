import { describe, it } from 'mocha'
import { expect } from 'chai'

import { bs58ToHex, hexToBs58 } from '../controller-helpers.js'

describe('hex util', function () {
  it('should convert bs58 to hex correctly', function () {
    const hex = bs58ToHex('QmYvYwvD33prqdjdFKKA1xaqoJjCzYViCUxH9z7qMgBR6Q')
    expect(hex).to.equal('0x9d441a0fe4fb942070f4d3014e2367496d4afc3bc9b983f1ac5b3813467a0c19')
  })

  it('should convert hex to bs58 correctly', function () {
    const bs58 = hexToBs58('0x9d441a0fe4fb942070f4d3014e2367496d4afc3bc9b983f1ac5b3813467a0c19')
    expect(bs58).to.equal('QmYvYwvD33prqdjdFKKA1xaqoJjCzYViCUxH9z7qMgBR6Q')
  })
})
