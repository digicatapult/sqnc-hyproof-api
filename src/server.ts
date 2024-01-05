import express, { Express } from 'express'
import { setup, serve } from 'swagger-ui-express'
import cors from 'cors'

import { errorHandler } from './lib/error-handler/index.js'
import { RegisterRoutes } from './routes.js'
import * as swaggerJson from './swagger.json' with { type: 'json' }

export default async (): Promise<Express> => {
  const app: Express = express()
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
