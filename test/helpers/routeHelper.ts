import request from 'supertest'
import express from 'express'

export const get = async (app: express.Express, endpoint: string, headers: object = {}): Promise<request.Test> => {
  return request(app).get(endpoint).set(headers)
}

export const post = async (
  app: express.Express,
  endpoint: string,
  body: object,
  headers: object = {}
): Promise<request.Test> => {
  return request(app).post(endpoint).send(body).set(headers)
}

export const put = async (
  app: express.Express,
  endpoint: string,
  body: object,
  headers: object = {}
): Promise<request.Test> => {
  return request(app).put(endpoint).send(body).set(headers)
}

export const postFile = async (
  app: express.Express,
  endpoint: string,
  buf: Buffer,
  filename: string
): Promise<request.Test> => {
  return request(app).post(endpoint).set({ accept: 'application/octect-stream' }).attach('file', buf, filename)
}
