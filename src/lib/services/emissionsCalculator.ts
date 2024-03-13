import { singleton } from 'tsyringe'
import { z } from 'zod'

import { InternalServerError } from '../error-handler/index.js'
import { logger } from '../logger.js'

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
    energyConsumedWh: number
  ): Promise<number> {
    const url = this.intensityUrl(productionStartDate, productionEndDate)
    const response = await fetch(url)
    if (response.status !== 200) {
      throw new InternalServerError('Unexpected error fetching carbon intensity data')
    }
    const { data } = intensityResponseValidator.parse(await response.json())
    return this.calculateEmissions(data, productionStartDate, productionEndDate, energyConsumedWh)
  }

  public calculateEmissions(
    data: IntensityResponseData,
    productionStartDate: Date,
    productionEndDate: Date,
    energyConsumedWh: number
  ): number {
    const elapsedTimeHours = (productionEndDate.getTime() - productionStartDate.getTime()) / (1000 * 60 * 60)
    const averagePowerConsumptionKW = energyConsumedWh / (1000 * elapsedTimeHours)

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
    const emissionsRounded = Math.round(emissions)

    if (!Number.isFinite(emissionsRounded)) {
      logger.debug(
        'Error processing carbon intensity data. productionStartDate: %s, productionEndDate: %s, energyConsumedWh: %s',
        productionStartDate,
        productionEndDate,
        energyConsumedWh
      )
      logger.trace('Error processing carbon intensity data. data: %j', data)
      throw new InternalServerError('Unexpected error processing carbon intensity data')
    }
    return emissionsRounded
  }

  private intensityUrl(productionStartDate: Date, productionEndDate: Date): string {
    const from = new Date(new Date(productionStartDate).getTime() - 1000 * 60 * 60).toISOString()
    const to = new Date(new Date(productionEndDate).getTime() - 1000 * 60 * 60).toISOString()
    return `https://api.carbonintensity.org.uk/intensity/${from}/${to}`
  }
}
