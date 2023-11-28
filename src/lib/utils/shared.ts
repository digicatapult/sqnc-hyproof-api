import * as Certificate from '../../models/certificate'

export function camelToSnakeJSObject(body: Certificate.Request): Record<string, any> {
  const formatted = Object.keys(body).reduce(
    (out, key) => ({
      [key
        .replace(/([a-z])([A-Z])/g, '$1_$2')
        .trim()
        .toLowerCase()]: body[key],
      ...out,
    }),
    {}
  )
  return formatted
}

export function snakeToCamel(str: string): string {
  return str.replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase())
}
