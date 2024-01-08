import { expect } from 'chai'
import sinon from 'sinon'

import { attachment } from '../index.js'
import { Env } from '../../../../env.js'
import Database from '../../../../lib/db/index.js'
import { attachmentExample } from './fixtures.js'
import Ipfs from '../../../../lib/ipfs.js'
import { BadRequest } from '../../../../lib/error-handler/index.js'

describe('v1/attachment', () => {
  let response: any
  let controller: attachment
  const database: Database = new Database()
  const ipfs: Ipfs = new Ipfs(new Env())

  const stubs = {
    getFile: sinon
      .stub(ipfs, 'getFile' as any)
      .callsFake(async () => ({ blob: { arrayBuffer: () => '0'.repeat(1024) }, filename: 'a' })),
    addFile: sinon.stub(ipfs, 'addFile' as any).callsFake(async () => 'QmXVStDC6kTpVHY1shgBQmyA4SuSrYnNRnHSak5iB6Eehn'),
    get: sinon.stub(database, 'get').callsFake(async () => [attachmentExample]),
    update: sinon.stub(database, 'update' as any).callsFake(async (_, updates: any) => [
      {
        ...attachmentExample,
        ...updates,
      },
    ]),
    insert: sinon
      .stub(database, 'insert' as any)
      .callsFake((_, data: any) => [
        { ...data, created_at: new Date('2024-01-08T09:07:12.830Z'), id: 'attachment-insert-test' },
      ]),
  }

  before(() => {
    controller = new attachment(database, ipfs)
  })

  after(() => {
    stubs.get.reset()
    stubs.getFile.reset()
    stubs.insert.reset()
    stubs.get.reset()
    stubs.update.reset()
  })

  describe('create() - POST /', () => {
    describe('if payload does not contain body or file', () => {
      beforeEach(async () => {
        response = await controller.create({} as any).catch((err) => err)
      })

      it('throws BadRequest error', () => {
        expect(response).to.be.instanceOf(BadRequest)
        expect(response.code).to.equal(400)
        expect(response.message).to.equal('nothing to upload')
      })

      it('does not call ipfs', () => {
        expect(stubs.addFile.callCount).to.equal(0)
      })

      it('and does not call database insert method', () => {
        expect(stubs.insert.callCount).to.equal(0)
      })
    })

    describe('uploads Multer.File', () => {
      beforeEach(async () => {
        response = await controller.create(
          {} as any,
          { originalname: 'attachments-controller.txt', buffer: Buffer.alloc(1024, 0) } as Express.Multer.File
        )
      })

      it('uploads to ipfs and gets an ipfs hash', () => {
        expect(stubs.addFile.lastCall.args[0]).to.deep.contain({
          filename: 'attachments-controller.txt',
        })
      })

      it('persists a new attachment', () => {
        expect(stubs.insert.lastCall.args[0]).to.equal('attachment')
        expect(stubs.insert.lastCall.args[1]).to.deep.contain({
          filename: 'attachments-controller.txt',
          ipfs_hash: 'QmXVStDC6kTpVHY1shgBQmyA4SuSrYnNRnHSak5iB6Eehn',
          size: 1024,
        })
      })

      it('returns attachments', () => {
        expect(response).to.deep.contain({
          ...attachmentExample,
          id: 'attachment-insert-test',
        })
      })
    })

    describe('also uploads JSON from req.body', () => {
      beforeEach(async () => {
        response = await controller.create({ body: { data: 'attachment-test' } } as any)
      })

      it('guploads to ipfs and gets an ipfs hash', () => {
        expect(stubs.addFile.lastCall.args[0]).to.deep.contain({
          filename: 'json',
        })
      })

      it('persists a new attachment', () => {
        expect(stubs.insert.lastCall.args[0]).to.equal('attachment')
        expect(stubs.insert.lastCall.args[1]).to.deep.contain({
          filename: 'json',
          ipfs_hash: 'QmXVStDC6kTpVHY1shgBQmyA4SuSrYnNRnHSak5iB6Eehn',
          size: 26,
        })
      })

      it('returns attachments', () => {
        expect(response).to.deep.contain({
          filename: 'json',
          size: 26,
          id: 'attachment-insert-test',
        })
      })
    })
  })

  describe('getAll() - GET /', () => {
    beforeEach(async () => {
      stubs.get.resetHistory()
      stubs.get.callsFake(async () => [
        attachmentExample,
        {
          id: 'attachment-2-test',
          created_at: new Date('2024-01-05T09:39:29.785Z'),
          filename: 'json',
          ipfs_hash: 'QmXVStDC6kTpVHY1shgBQmyA4SuSrYnNRnHSak5iB6Eehn',
          size: 26,
        },
      ]),
        (response = await controller.getAll())
    })

    describe('if none found it', () => {
      beforeEach(async () => {
        stubs.get.resetHistory()
        stubs.get.callsFake(async () => [])
        response = await controller.getAll()
      })

      it('returns an empty array', () => {
        expect(response).to.be.empty
      })
    })

    it('returns all attachments from a local db', () => {
      expect(response.length).to.equal(2)
      expect(response).to.deep.include.members([
        {
          filename: 'attachments-controller.txt',
          size: 1024,
          ipfs_hash: 'QmXVStDC6kTpVHY1shgBQmyA4SuSrYnNRnHSak5iB6Eehn',
          id: 'attachment-1-test',
          created_at: new Date('2024-01-05T09:07:12.830Z'),
        },
        {
          id: 'attachment-2-test',
          created_at: new Date('2024-01-05T09:39:29.785Z'),
          filename: 'json',
          ipfs_hash: 'QmXVStDC6kTpVHY1shgBQmyA4SuSrYnNRnHSak5iB6Eehn',
          size: 26,
        },
      ])
    })
  })

  describe('getById() - GET /{id}', () => {
    describe('if accept header is octet-stream', () => {
      beforeEach(async () => {
        stubs.get.resetHistory()
        stubs.get.callsFake(async () => [attachmentExample])
        response = await controller.getById({ headers: { accept: 'application/octet-stream' } } as any, 'octet-id')
      })

      it('returns as octet', () => {
        expect(response).to.equal('')
      })
    })

    describe('if accept header is json', () => {
      beforeEach(async () => {
        stubs.get.resetHistory()
        stubs.get.callsFake(async () => [
          {
            id: 'attachment-2-test',
            created_at: new Date('2024-01-05T09:39:29.785Z'),
            filename: 'json',
            ipfs_hash: 'QmXVStDC6kTpVHY1shgBQmyA4SuSrYnNRnHSak5iB6Eehn',
            size: 26,
          },
        ])

        response = await controller.getById({ headers: { accept: 'application/json' } } as any, 'json-id')
      })

      it('returns parsed json', () => {
        expect(response).to.equal('')
      })
    })

    describe('', () => {
      beforeEach(() => {})
      it('', () => {})
    })

    it('', () => {})
    it('', () => {})
    it('', () => {})
  })
})
