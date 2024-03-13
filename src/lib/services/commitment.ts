import crypto from 'node:crypto'
import util from 'node:util'
import { singleton } from 'tsyringe'

const { getHashes, createHash } = crypto
const generateKey = util.promisify(crypto.generateKey)

const algos = ['sha256', 'shake128', 'shake256'] as const
type ALGOS_TUPLE = typeof algos
export type ALGOS = ALGOS_TUPLE[number]
const getBlockLength = (algo: ALGOS): number => {
  switch (algo) {
    case 'sha256':
      return 256
    case 'shake128':
      return 128
    case 'shake256':
      return 256
  }
}

export const buildDigest = (hasher: crypto.Hmac, values: Record<string, string | number | Date>): string => {
  const sortedPairs = Object.entries(values).sort(([a], [b]) => a.localeCompare(b, 'en'))
  for (const [key, value] of sortedPairs) {
    let valStr: string | null = null
    if (typeof value === 'number') {
      valStr = '' + value
    } else if (value instanceof Date) {
      valStr = value.toISOString()
    } else valStr = value

    hasher.update(key, 'utf8')
    hasher.update(valStr, 'utf8')
  }
  return hasher.digest().toString('hex')
}

@singleton()
export default class Commitment {
  blockSize: number

  constructor(public algo: ALGOS) {
    const hashes = new Set(getHashes())
    if (!hashes.has(algo)) {
      throw new Error(`Invalid cypher: ${algo}`)
    }
    this.blockSize = getBlockLength(algo)
  }

  build = async (values: Record<string, string | number | Date>): Promise<{ salt: string; digest: string }> => {
    const salt = (await generateKey('hmac', { length: this.blockSize })).export()
    const hasher = createHash(this.algo)
    hasher.update(salt)
    const digest = buildDigest(hasher, values)

    return {
      salt: salt.toString('hex'),
      digest,
    }
  }

  validate = (values: Record<string, string | number | Date>, salt: string, digest: string): boolean => {
    const saltAsBuffer = Buffer.from(salt, 'hex')
    const hasher = createHash(this.algo)
    hasher.update(saltAsBuffer)
    return buildDigest(hasher, values) === digest
  }
}
