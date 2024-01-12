import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import express, { Express } from 'express'
import { setup, serve } from 'swagger-ui-express'
import cors from 'cors'
import bodyParser from 'body-parser'

import { errorHandler } from './lib/error-handler/index.js'
import { RegisterRoutes } from './routes.js'

// import { container } from 'tsyringe'

import { Env } from './env.js'

const env = new Env() // const env = container.resolve(Env)

const API_SWAGGER_BG_COLOR = env.get('API_SWAGGER_BG_COLOR')
const API_SWAGGER_TITLE = env.get('API_SWAGGER_TITLE')
const API_SWAGGER_HEADING = env.get('API_SWAGGER_HEADING')

const customCssToInject = `

  body { background-color: ${API_SWAGGER_BG_COLOR}; }
  .swagger-ui .scheme-container { background-color: inherit; }
  .swagger-ui .opblock .opblock-section-header { background: inherit; }
  .topbar { display: none; }
  .swagger-ui .btn.authorize { background-color: #f7f7f7; }
  .swagger-ui .opblock.opblock-post { background: rgba(73,204,144,.3); }
  .swagger-ui .opblock.opblock-get { background: rgba(97,175,254,.3); }
  .swagger-ui .opblock.opblock-put { background: rgba(252,161,48,.3); }
  .swagger-ui .opblock.opblock-delete { background: rgba(249,62,62,.3); }
  .swagger-ui section.models { background-color: #f7f7f7; }

`

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default async (): Promise<Express> => {
  const swaggerBuffer = await fs.readFile(path.join(__dirname, './swagger.json'))
  const swaggerJson = JSON.parse(swaggerBuffer.toString('utf8'))
  swaggerJson.info.title += `:${API_SWAGGER_HEADING}`
  const app: Express = express()

  const options = {
    swaggerOptions: { url: '/api-docs' },
    customCss: customCssToInject,
    customSiteTitle: API_SWAGGER_TITLE,
  }

  app.use(bodyParser.urlencoded({ extended: true }))
  app.use(bodyParser.json())
  app.use(cors())

  RegisterRoutes(app)
  app.use(errorHandler)
  app.get('/api-docs', (_req, res) => res.json(swaggerJson))
  app.use('/swagger', serve, setup(undefined, options))

  return app
}
