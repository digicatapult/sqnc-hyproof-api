import * as express from 'express'

/* eslint-disable @typescript-eslint/no-unused-vars */
export function expressAuthentication(
  _request: express.Request,
  _securityName: string,
  _scopes?: string[]
): Promise<boolean> {
  return Promise.resolve(true) // header is passed through for external authentication
}
