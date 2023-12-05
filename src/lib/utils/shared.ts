import { HEX } from '../../models/strings'

export function camelToSnake(str: string | number): string {
  return str
    .toString()
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .trim()
    .toLowerCase()
}

export function snakeToCamel(str: string): string {
  return str.replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase())
}

export function restore0x(input: string): HEX {
  return input.startsWith('0x') ? (input as HEX) : `0x${input}`
}

export function trim0x(input: string): string {
  return input.startsWith('0x') ? input.slice(2) : input
}
