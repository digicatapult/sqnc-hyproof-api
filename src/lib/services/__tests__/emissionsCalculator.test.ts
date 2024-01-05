import { describe, it } from 'mocha'
import { expect } from 'chai'

import EmissionsCalculator, { IntensityResponseData } from '../emissionsCalculator.js'
import { InternalServerError } from '../../error-handler/index.js'

const date1 = new Date('2023-01-01T00:00Z')
const date2 = new Date('2023-01-02T00:00Z')

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
      const result = calc.calculateEmissions(fullBoundData, date1, date2, 10)
      expect(result).to.equal(10 * 1000 * 100) // 10MWh are emitted in the fullBoundRange. 100gCO2/KWh => 10 * 1000 * 100
    })

    it('should return correct value with data that fully bounds range (42)', function () {
      const calc = new EmissionsCalculator()
      const result = calc.calculateEmissions(fullBoundData, date1, date2, 42)
      expect(result).to.equal(42 * 1000 * 100) // 10MWh are emitted in the fullBoundRange. 100gCO2/KWh => 42 * 1000 * 100
    })

    it('should handle the forecast split per hour', function () {
      const calc = new EmissionsCalculator()
      const result = calc.calculateEmissions(fullBoundSplit, date1, date2, 10)
      expect(Math.round(result)).to.equal(10 * 1000 * 100) // 10MWh are emitted in the fullBoundRange. 100gCO2/KWh => 10 * 1000 * 100
    })

    it('should handle graduated forecast', function () {
      const calc = new EmissionsCalculator()
      const result = calc.calculateEmissions(graduatedIntensity, date1, date2, 10)
      expect(Math.round(result)).to.equal(10 * 1000 * 125) // 10MWh are consumed. Rate is average of 10 * (h + 1) for each h 250 * 12 / 24 = 125.
    })

    it('should handle forecast beyond range', function () {
      const calc = new EmissionsCalculator()
      const result = calc.calculateEmissions(withExtendedRanges, date1, date2, 10)
      expect(Math.round(result)).to.equal(10 * 1000 * 130) // 10MWh are consumed. Rate is 10 (h + 1) for each h. First hour and last hour only count half (5 and 125). Therefore rate is (5 + (11 * 260 + 130) + 125) / 24 = 130
    })
  })
})
