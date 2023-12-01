import { describe, before } from 'mocha'
import { Express } from 'express'
import { expect } from 'chai'

import createHttpServer from '../../../src/server'
import { get, post, postFile } from '../../helpers/routeHelper'

import { withIpfsMockError, withIpfsMock } from '../../helpers/mock'
import { cleanup, attachmentSeed } from '../../seeds/attachment'

describe('attachment', () => {
  const size = 100
  const blobData = 'a'.repeat(size)
  const filename = 'test.pdf'
  const overSize = 115343360
  const overSizeBlobData = 'a'.repeat(overSize)
  const jsonData = { key: 'it', filename: 'JSON attachment it' }
  let app: Express

  before(async () => {
    app = await createHttpServer()
  })

  afterEach(async () => {
    await cleanup()
  })

  describe('invalid requests', () => {
    it('returns 422 when attempting to retrieve by not UUID', async () => {
      const { status, body } = await get(app, '/v1/attachment/not-uuid')

      expect(status).to.equal(422)
      expect(body).to.have.keys(['fields', 'message', 'name'])
      expect(body).to.contain({
        name: 'ValidateError',
        message: 'Validation failed',
      })
    })

    it('returns 404 if no records found', async () => {
      const { status, body } = await get(app, '/v1/attachment/afe7e60a-2fd8-43f9-9867-041f14e3e8f4')

      expect(status).to.equal(404)
      expect(body).to.equal('attachment not found')
    })

    it('returns 422 with invalid updated_since date', async () => {
      const { status, body } = await get(app, `/v1/attachment?createdAt=foo`)
      expect(status).to.equal(422)
      expect(body).to.contain({
        name: 'ValidateError',
        message: 'Validation failed',
      })
    })
  })

  describe('list attachments', () => {
    beforeEach(async () => await attachmentSeed())

    it('returns attachments', async () => {
      const {
        status,
        body: { attachments },
      } = await get(app, `/v1/attachment`)
      expect(status).to.equal(200)
      expect(attachments[0]).to.deep.contain({
        created_at: '2023-01-01T00:00:00.000Z',
        filename: 'test.txt',
        id: 'a789ad47-91c3-446e-90f9-a7c9b233eaf8',
        size: '42',
      })
    })

    it('filters attachments based on created date', async () => {
      const {
        status,
        body: { message, attachments },
      } = await get(app, `/v1/attachment?createdAt=2023-01-01T00:00:00.000Z`)
      expect(status).to.equal(200)
      expect(message).to.equal('ok')
      expect(attachments).to.deep.equal([
        {
          binary_blob: null,
          created_at: '2023-01-01T00:00:00.000Z',
          filename: 'test.txt',
          id: 'a789ad47-91c3-446e-90f9-a7c9b233eaf8',
          ipfs_hash: 'QmXVStDC6kTpVHY1shgBQmyA4SuSrYnNRnHSak5iB6Eehn',
          size: '42',
        },
      ])
    })

    it('returns 404 if none found based on created date', async () => {
      const { status, body } = await get(app, `/v1/attachment?createdAt=2010-01-01T00:00:00.000Z`)
      expect(status).to.equal(404)
      expect(body).to.equal('attachment not found')
    })
  })

  describe('uploads and retrieves attachment [octet]', () => {
    let octetRes: any

    withIpfsMock(blobData)

    beforeEach(async () => {
      octetRes = await postFile(app, '/v1/attachment', Buffer.from(blobData), filename)
    })

    it('confirms JSON attachment uploads', () => {
      // assert octect
      expect(octetRes.status).to.equal(201)
      expect(octetRes.body.message).to.equal('ok')
      expect(octetRes.error).to.equal(false)
      expect(octetRes.body).to.have.property('attachments')
    })

    it('returns octet attachment', async () => {
      const { id } = octetRes.body.attachments[0]
      const { status, body, header } = await get(app, `/v1/attachment/${id}`, { accept: 'application/octet-stream' })

      expect(status).to.equal(200)
      expect(Buffer.from(body).toString()).to.equal(blobData)
      expect(header).to.deep.contain({
        immutable: 'true',
        maxage: '31536000000',
        'content-type': 'application/octet-stream',
        'access-control-expose-headers': 'content-disposition',
        'content-disposition': 'attachment; filename="test.pdf"',
      })
    })

    it('returns octet when JSON.parse fails', async () => {
      const { id } = octetRes.body.attachments[0]
      const { status, body, header } = await get(app, `/v1/attachment/${id}`, { accept: 'application/json' })

      expect(status).to.equal(200)
      expect(Buffer.from(body).toString()).to.equal(blobData)
      expect(header).to.deep.contain({
        immutable: 'true',
        maxage: '31536000000',
        'content-type': 'application/octet-stream',
        'access-control-expose-headers': 'content-disposition',
        'content-disposition': 'attachment; filename="test.pdf"',
      })
    })
  })

  describe('uploads and retrieves attachment [json]', () => {
    let jsonRes: any

    withIpfsMock(jsonData)

    beforeEach(async () => {
      jsonRes = await post(app, '/v1/attachment', jsonData)
    })

    it('confirms JSON and octet attachment uploads', () => {
      // assert JSON
      expect(jsonRes.status).to.equal(201)
      expect(jsonRes.body.attachments[0]).to.contain.keys(['id'])
    })

    it('returns JSON attachment', async () => {
      const { id } = jsonRes.body.attachments[0]
      const { status, body } = await get(app, `/v1/attachment/${id}`, { accept: 'application/json' })

      expect(status).to.equal(200)
      expect(body).to.contain(jsonData)
    })

    it('attachment as octet with the filename [json]', async () => {
      const { id } = jsonRes.body.attachments[0]
      const { status, body, header } = await get(app, `/v1/attachment/${id}`, {
        accept: 'application/octet-stream',
      })

      expect(status).to.equal(200)
      expect(Buffer.from(body).toString()).to.equal('{"key":"it","filename":"JSON attachment it"}')
      expect(header).to.deep.contain({
        immutable: 'true',
        maxage: '31536000000',
        'content-type': 'application/octet-stream',
        'access-control-expose-headers': 'content-disposition',
        'content-disposition': 'attachment; filename="json"',
      })
    })
  })

  it('Doesn`t upload files if more than 100mb', async () => {
    const uploadRes = await postFile(app, '/v1/attachment', Buffer.from(overSizeBlobData), 'json')
    const { status, body } = await get(app, `/v1/attachment/${uploadRes.body.id}`)

    expect(status).to.equal(422)
    expect(body.toString()).to.deep.contain({ message: 'Validation failed' })
  })

  describe('IPFS errors', function () {
    withIpfsMockError()

    it('ipfs error - 500', async () => {
      const { status, body } = await post(app, '/v1/attachment', jsonData)
      expect(status).to.equal(500)
      expect(body).to.equal('error')
    })
  })
})
