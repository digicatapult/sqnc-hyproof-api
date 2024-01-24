import { describe, before } from 'mocha'
import { Express } from 'express'
import { expect } from 'chai'

import createHttpServer from '../../../src/server.js'
import { put } from '../../helpers/routeHelper.js'
import { cleanup, updateSeed } from '../../seeds/certificate.js'
import { CertificateRow } from '../../../src/lib/db/types.js'
import { notSelfAlias, regulatorAlias, selfAlias, withExternalServicesMock } from '../../helpers/mock.js'

describe('certificate', () => {
  let certificate: CertificateRow
  let app: Express

  before(async () => {
    app = await createHttpServer()
  })

  beforeEach(async function () {
    certificate = await updateSeed()
  })

  afterEach(async () => {
    await cleanup()
  })

  withExternalServicesMock()

  it('should update the certificate if the correct commitment data is provided', async function () {
    const { status, body } = await put(app, `/v1/certificate/${certificate.id}`, {
      production_start_time: new Date('2023-12-01T00:00:00.000Z'),
      production_end_time: new Date('2023-12-02T00:00:00.000Z'),
      energy_consumed_wh: 2000000,
      commitment_salt: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    })

    expect(status).to.equal(200)
    expect(body).to.deep.contain({
      hydrogen_owner: notSelfAlias,
      energy_owner: selfAlias,
      regulator: regulatorAlias,
      production_start_time: '2023-12-01T00:00:00.000Z',
      production_end_time: '2023-12-02T00:00:00.000Z',
      energy_consumed_wh: 2000000,
      commitment_salt: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    })
  })

  it('should error if the incorrect commitment data is provided', async function () {
    const { status, body } = await put(app, `/v1/certificate/${certificate.id}`, {
      production_start_time: new Date('2023-12-01T00:00:00.000Z'),
      production_end_time: new Date('2023-12-02T00:00:00.000Z'),
      energy_consumed_wh: 3000000,
      commitment_salt: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    })

    expect(status).to.equal(400)
    expect(body).to.equal('Commitment did not match update')
  })
})
