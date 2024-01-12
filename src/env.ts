import * as envalid from 'envalid'
import dotenv from 'dotenv'
import { singleton } from 'tsyringe'

if (process.env.NODE_ENV === 'test') {
  dotenv.config({ path: 'test/test.env' })
} else {
  dotenv.config()
}

const envConfig = {
  PORT: envalid.port({ default: 3000 }),
  LOG_LEVEL: envalid.str({ default: 'info', devDefault: 'debug' }),
  DB_HOST: envalid.str({ devDefault: 'localhost' }),
  DB_PORT: envalid.port({ default: 5432 }),
  DB_USERNAME: envalid.str({ devDefault: 'postgres' }),
  DB_PASSWORD: envalid.str({ devDefault: 'postgres' }),
  DB_NAME: envalid.str({ default: 'dscp-hyproof-api' }),
  IDENTITY_SERVICE_HOST: envalid.host({ devDefault: 'localhost' }),
  IDENTITY_SERVICE_PORT: envalid.port({ devDefault: 3002, default: 3000 }),
  NODE_HOST: envalid.host({ default: 'localhost' }),
  NODE_PORT: envalid.port({ default: 9944 }),
  ENABLE_INDEXER: envalid.bool({ default: true }),
  USER_URI: envalid.str({ devDefault: '//Alice' }),
  IPFS_HOST: envalid.host({ devDefault: 'localhost' }),
  IPFS_PORT: envalid.port({ default: 5001 }),
  WATCHER_POLL_PERIOD_MS: envalid.num({ default: 10 * 1000 }),
  WATCHER_TIMEOUT_MS: envalid.num({ default: 2 * 1000 }),
  API_SWAGGER_BG_COLOR: envalid.str({ default: '#fafafa' }),
  API_SWAGGER_TITLE: envalid.str({ default: 'API' }),
  API_SWAGGER_HEADING: envalid.str({ default: 'ApiService' }),
}

export type ENV_CONFIG = typeof envConfig
export type ENV_KEYS = keyof ENV_CONFIG

@singleton()
export class Env {
  private vals: envalid.CleanedEnv<typeof envConfig>

  constructor() {
    this.vals = envalid.cleanEnv(process.env, envConfig)
  }

  get<K extends ENV_KEYS>(key: K) {
    return this.vals[key]
  }
}
