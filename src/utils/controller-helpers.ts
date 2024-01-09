import basex from 'base-x'

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const bs58 = basex(BASE58)

export const bs58ToHex = (hash: string) => {
  const decoded = Buffer.from(bs58.decode(hash))
  return `0x${decoded.toString('hex').slice(4)}` //remove 1220 prefix
}

export const hexToBs58 = (hex: string) => {
  const stripped = hex.startsWith('0x') ? hex.slice(2) : hex
  const buffer = Buffer.from(`1220${stripped}`, 'hex')
  return bs58.encode(buffer)
}


export const parseAccept = (acceptHeader: string) =>
acceptHeader
  .split(',')
  .map((acceptElement) => {
    const trimmed = acceptElement.trim()
    const [mimeType, quality = '1'] = trimmed.split(';q=')
    return { mimeType, quality: parseFloat(quality) }
  })
  .sort((a, b) => {
    if (a.quality !== b.quality) {
      return b.quality - a.quality
    }
    const [aType, aSubtype] = a.mimeType.split('/')
    const [bType, bSubtype] = b.mimeType.split('/')
    if (aType === '*' && bType !== '*') {
      return 1
    }
    if (aType !== '*' && bType === '*') {
      return -1
    }
    if (aSubtype === '*' && bSubtype !== '*') {
      return 1
    }
    if (aSubtype !== '*' && bSubtype === '*') {
      return -1
    }
    return 0
  })
  .map(({ mimeType }) => mimeType)

/*
const responseWithAliases = async (example: Match2Row, identity: Identity): Promise<Match2Response> => {
  const { originalTokenId, latestTokenId, ...rest } = example

  return {
    ...rest,
    optimiser: await identity.getMemberByAddress(example.optimiser).then(({ alias }) => alias),
    memberA: await identity.getMemberByAddress(example.memberA).then(({ alias }) => alias),
    memberB: await identity.getMemberByAddress(example.memberB).then(({ alias }) => alias),
    createdAt: example.createdAt.toISOString(),
    updatedAt: example.updatedAt.toISOString(),
    replaces: example.replaces ? example.replaces : undefined,
  }
}


const validatePreLocal = <T>(maybeT: T | undefined, rowType: string, condition: { [key in keyof T]?: T[key] }) => {
  if (!maybeT) {
    throw new BadRequest(`${rowType} not found`)
  }

  const conditionKeys = Object.keys(condition) as (keyof T)[]
  for (const key of conditionKeys) {
    if (maybeT[key] !== condition[key]) {
      throw new BadRequest(`${String(key)} must be ${condition[key]}, is: ${maybeT[key]}`)
    }
  }
}

const validatePreOnChain = <
  T extends {
    latestTokenId: number | null
  },
>(
  maybeT: T | undefined,
  rowType: string,
  condition: { [key in keyof T]?: T[key] }
) => {
  validatePreLocal(maybeT, rowType, condition)
  const t = maybeT as T

  if (!t.latestTokenId) {
    throw new BadRequest(`${rowType} must be on chain`)
  }
}
*/
