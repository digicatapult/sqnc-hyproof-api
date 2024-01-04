import pino, { Logger } from 'pino'
import { container } from 'tsyringe'

import { Env } from '../env'

const env = container.resolve(Env)

export const logger: Logger = pino(
  {
    name: 'dscp-hyproof-api',
    timestamp: true,
    level: env.get('LOG_LEVEL'),
  },
  process.stdout
)
