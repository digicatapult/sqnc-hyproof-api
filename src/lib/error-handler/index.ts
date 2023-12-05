import { Response as ExResponse, Request as ExRequest, NextFunction } from 'express'
import { ValidateError } from 'tsoa'
import { Health } from '../../models'

import { logger } from '../logger'

/**
 * this should reflect database tables
 */
interface INotFound {
  message?: string
  item: string
  name: string
}

interface IBadRequest {
  message?: string
  name: string
}

export class HttpResponse extends Error {
  public code: number
  public message: string

  constructor({ code = 500, message = 'Internal server error' }) {
    super(message)
    this.code = code
    this.message = message
  }
}

/**
 * reports that item was not found
 */
export class NotFound extends HttpResponse implements INotFound {
  // TODO once pull of all items is clear update with 'item1' | 'item2'
  public item: string

  constructor(item: string) {
    super({ code: 404, message: `${item} not found` })
    this.item = item
    this.name = 'not found'
  }
}

/**
 * indicates that request was invalid e.g. missing parameter
 */
export class BadRequest extends HttpResponse implements IBadRequest {
  constructor(message = 'bad request') {
    super({ code: 400, message })
  }
}

/**
 * indicates that an unknown error occurred
 */
export class InternalServerError extends HttpResponse {
  constructor(message = 'unknown error') {
    super({ code: 500, message })
  }
}

export class ServiceUnavailable extends HttpResponse {
  public code: number
  public data: Health

  constructor(code: number, data: Health) {
    super({ code: 503, message: '' })
    this.code = code
    this.data = data
  }
}

export const errorHandler = function errorHandler(
  err: Error & { code: number; data?: object },
  req: ExRequest,
  res: ExResponse,
  next: NextFunction
): ExResponse | void {
  if (err instanceof ValidateError) {
    logger.warn(`Handled Validation Error for ${req.path}: %s`, JSON.stringify(err.fields))

    const { status, ...rest } = err

    return res.status(422).send({
      ...rest,
      message: 'Validation failed',
    })
  }
  if (err instanceof ServiceUnavailable) {
    logger.warn('Error thrown in Health Watcher')
    return res.status(err.code).json(err.data)
  }
  if (err instanceof HttpResponse) {
    logger.warn('Error thrown in handler: %s', err.message)

    return res.status(err.code).json(err.message)
  }
  if (err instanceof Error) {
    logger.error('Unexpected error thrown in handler: %s', err.message)

    return res.status(500).json(err)
  }

  next()
}
