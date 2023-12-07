import { singleton } from 'tsyringe'
import { InternalServerError } from '../error-handler'

import { z } from 'zod'

import { logger } from '../logger'

const intensityResponseValidator = z.object({
  data: z.array(
    z.object({
      from: z.string().transform((s) => new Date(s)),
      to: z.string().transform((s) => new Date(s)),
      intensity: z.object({
        forecast: z.number(),
        actual: z.number(),
        index: z.union([
          z.literal('very low'),
          z.literal('low'),
          z.literal('moderate'),
          z.literal('high'),
          z.literal('very high'),
        ]),
      }),
    })
  ),
})

export type IntensityResponseData = z.infer<typeof intensityResponseValidator>['data']

@singleton()
export default class EmissionsCalculator {
  constructor() {}

  public async fetchEmissions(
    productionStartDate: Date,
    productionEndDate: Date,
    energyConsumedMWh: number
  ): Promise<number> {
    const url = this.intensityUrl(productionStartDate, productionEndDate)
    const response = await fetch(url)
    if (response.status !== 200) {
      throw new InternalServerError('Unexpected error fetching carbon intensity data')
    }
    const { data } = intensityResponseValidator.parse(await response.json())
    return this.calculateEmissions(data, productionStartDate, productionEndDate, energyConsumedMWh)
  }

  public calculateEmissions(
    data: IntensityResponseData,
    productionStartDate: Date,
    productionEndDate: Date,
    energyConsumedMWh: number
  ): number {
    const elapsedTimeHours = (productionEndDate.getTime() - productionStartDate.getTime()) / (1000 * 60 * 60)
    const averagePowerConsumptionKW = (1000 * energyConsumedMWh) / elapsedTimeHours

    const emissions = data.reduce((acc, period) => {
      if (period.to < productionStartDate || period.from > productionEndDate) {
        return acc
      }

      const overlapMs =
        Math.min(period.to.getTime(), productionEndDate.getTime()) -
        Math.max(period.from.getTime(), productionStartDate.getTime())
      const overlapH = overlapMs / (1000 * 60 * 60)

      return acc + period.intensity.actual * (averagePowerConsumptionKW * overlapH)
    }, 0)

    if (!Number.isFinite(emissions)) {
      logger.debug(
        'Error processing carbon intensity data. productionStartDate: %s, productionEndDate: %s, energyConsumedMWh: %s',
        productionStartDate,
        productionEndDate,
        energyConsumedMWh
      )
      logger.trace('Error processing carbon intensity data. data: %j', data)
      throw new InternalServerError('Unexpected error processing carbon intensity data')
    }
    return emissions
  }

  private intensityUrl(productionStartDate: Date, productionEndDate: Date): string {
    return `https://api.carbonintensity.org.uk/intensity/${productionStartDate.toISOString()}/${productionEndDate.toISOString()}`
  }
}
