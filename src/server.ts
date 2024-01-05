import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import express, { Express } from 'express'
import { setup, serve } from 'swagger-ui-express'
import cors from 'cors'
import bodyParser from 'body-parser'

import { errorHandler } from './lib/error-handler/index.js'
import { RegisterRoutes } from './routes.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default async (): Promise<Express> => {
  const swaggerBuffer = await fs.readFile(path.join(__dirname, './swagger.json'))
  const swaggerJson = JSON.parse(swaggerBuffer.toString('utf8'))
  const app: Express = express()
  app.use(bodyParser.urlencoded({ extended: true }))
  app.use(bodyParser.json())
  app.use(cors())

  RegisterRoutes(app)
  app.use(errorHandler)
  app.get('/api-docs', (_req, res) => res.json(swaggerJson))
  app.use(
    '/swagger',
    serve,
    setup(undefined, {
      swaggerOptions: {
        url: '/api-docs',
      },
    })
  )

  return app
}
