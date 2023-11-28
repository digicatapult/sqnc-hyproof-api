// TODO sort types and unify helpers
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
