import { afterEach, beforeEach, describe, it } from 'mocha'
import { expect } from 'chai'
import { spy } from 'sinon'
import { MockAgent, setGlobalDispatcher, getGlobalDispatcher } from 'undici'

import EmissionsCalculator, { IntensityResponseData } from '../emissionsCalculator.js'
import { InternalServerError } from '../../error-handler/index.js'

const date1 = new Date('2023-01-01T10:00Z')
const date2 = new Date('2023-01-02T10:00Z')
const co2ShortDateIntervalRes = [
  {
    from: new Date('2023-01-01T06:00:00.000Z'),
    to: new Date('2023-01-01T06:30:00.000Z'),
    intensity: {
      actual: 154.456789123,
      forecast: 100,
      index: 'moderate',
    },
  },
  {
    from: new Date('2023-01-01T06:30:00.000Z'),
    to: new Date('2023-01-01T07:00:00.000Z'),
    intensity: {
      actual: 120.456789123,
      forecast: 100,
      index: 'low',
    },
  },
]

const fullBoundData: IntensityResponseData = [
  {
    from: date1,
    to: date2,
    intensity: {
      actual: 100,
      forecast: 100,
      index: 'moderate',
    },
  },
]
const fullBoundSplit: IntensityResponseData = new Array(24).fill(null).map((_, i) => {
  return {
    from: new Date(date1.getTime() + i * 60 * 60 * 1000),
    to: new Date(date1.getTime() + (i + 1) * 60 * 60 * 1000),
    intensity: {
      actual: 100,
      forecast: 100,
      index: 'moderate',
    },
  }
})
const graduatedIntensity: IntensityResponseData = new Array(24).fill(null).map((_, i) => {
  return {
    from: new Date(date1.getTime() + i * 60 * 60 * 1000),
    to: new Date(date1.getTime() + (i + 1) * 60 * 60 * 1000),
    intensity: {
      actual: 10 * (i + 1),
      forecast: 100,
      index: 'moderate',
    },
  }
})
const withExtendedRanges: IntensityResponseData = new Array(25).fill(null).map((_, i) => {
  return {
    from: new Date(date1.getTime() + i * 60 * 60 * 1000 - 30 * 60 * 1000),
    to: new Date(date1.getTime() + (i + 1) * 60 * 60 * 1000 - 30 * 60 * 1000),
    intensity: {
      actual: 10 * (i + 1),
      forecast: 100,
      index: 'moderate',
    },
  }
})

describe('EmissionsCalculator', function () {
  const originalDispatcher = getGlobalDispatcher()
  const mockCarbon = new MockAgent().get(`https://api.carbonintensity.org.uk`)

  describe('fetchEmissions', function () {
    const startDateBelow30Min = new Date('2023-01-01T07:00:00.000Z')
    const endDateBelow30Min = new Date('2023-01-01T07:10:00.000Z')

    beforeEach(function () {
      setGlobalDispatcher(mockCarbon)
      mockCarbon
        .intercept({
          path: '/intensity/2023-01-01T06:00:00.000Z/2023-01-01T07:10:00.000Z',
          method: 'GET',
        })
        .reply(200, { data: co2ShortDateIntervalRes })
        .persist()
    })

    afterEach(function () {
      setGlobalDispatcher(originalDispatcher)
    })

    it('should add an hour even if times are under 30 mins to avoid empty response from co2', async function () {
      const calc = new EmissionsCalculator()
      const calculateEmissionsStub = spy(calc, 'calculateEmissions')
      await calc.fetchEmissions(new Date('2023-01-01T07:00:00.000Z'), new Date('2023-01-01T07:10:00.000Z'), 1000000)

      expect(calculateEmissionsStub.calledOnce).to.equal(true)
      expect(calculateEmissionsStub.getCall(0).args[0]).to.deep.equal(co2ShortDateIntervalRes)
      // validate that emissions calculator has been called with not updated times for co2 value
      expect(calculateEmissionsStub.getCall(0).args[1]).to.deep.equal(startDateBelow30Min)
      expect(calculateEmissionsStub.getCall(0).args[2]).to.deep.equal(endDateBelow30Min)
    })
  })

  describe('calculateEmissions', function () {
    it('should throw if calculation returns NaN', function () {
      const calc = new EmissionsCalculator()
      let error: Error | null = null
      try {
        calc.calculateEmissions(fullBoundData, date1, date2, Number.NaN)
      } catch (e) {
        if (e instanceof Error) {
          error = e
        }
      }

      expect(error).instanceOf(InternalServerError)
    })

    it('should return correct value with data that fully bounds range (10)', function () {
      const calc = new EmissionsCalculator()
      const result = calc.calculateEmissions(fullBoundData, date1, date2, 10000000)
      expect(result).to.equal(10 * 1000 * 100) // 10MWh are emitted in the fullBoundRange. 100gCO2/KWh => 10 * 1000 * 100
    })

    it('should return correct value with data that fully bounds range (42)', function () {
      const calc = new EmissionsCalculator()
      const result = calc.calculateEmissions(fullBoundData, date1, date2, 42000000)
      expect(result).to.equal(42 * 1000 * 100) // 10MWh are emitted in the fullBoundRange. 100gCO2/KWh => 42 * 1000 * 100
    })

    it('should handle the forecast split per hour', function () {
      const calc = new EmissionsCalculator()
      const result = calc.calculateEmissions(fullBoundSplit, date1, date2, 10000000)
      expect(Math.round(result)).to.equal(10 * 1000 * 100) // 10MWh are emitted in the fullBoundRange. 100gCO2/KWh => 10 * 1000 * 100
    })

    it('should handle graduated forecast', function () {
      const calc = new EmissionsCalculator()
      const result = calc.calculateEmissions(graduatedIntensity, date1, date2, 10000000)
      expect(Math.round(result)).to.equal(10 * 1000 * 125) // 10MWh are consumed. Rate is average of 10 * (h + 1) for each h 250 * 12 / 24 = 125.
    })

    it('should handle forecast beyond range', function () {
      const calc = new EmissionsCalculator()
      const result = calc.calculateEmissions(withExtendedRanges, date1, date2, 10000000)
      expect(Math.round(result)).to.equal(10 * 1000 * 130) // 10MWh are consumed. Rate is 10 (h + 1) for each h. First hour and last hour only count half (5 and 125). Therefore rate is (5 + (11 * 260 + 130) + 125) / 24 = 130
    })

    it('should round return', function () {
      const calc = new EmissionsCalculator()
      const result = calc.calculateEmissions(fullBoundData, date1, date2, 10000001)
      expect(result).to.equal(10 * 1000 * 100) // 10MWh are emitted in the fullBoundRange. 100gCO2/KWh => 10 * 1000 * 100
    })
  })
})
