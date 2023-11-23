import { Controller, Get, Route, Path, Response, Tags, Security, Query } from 'tsoa'
import type { Logger } from 'pino'
import { logger } from '../../../lib/logger'
import Database from '../../../lib/db'
import { DATE, UUID } from '../../../models/strings'
import { BadRequest, NotFound } from '../../../lib/error-handler/index'
import { TransactionApiType, TransactionResponse, TransactionState } from '../../../models/transaction'
import { parseDateParam } from '../../../lib/utils/queryParams'

@Route('v1/transaction')
@Tags('transaction')
@Security('BearerAuth')
export class TransactionController extends Controller {
  log: Logger
  db: Database

  constructor() {
    super()
    this.log = logger.child({ controller: '/transaction' })
    this.db = new Database()
  }

  /**
   * Returns the details of all transactions.
   * @summary List transactions
   * @Query apiType lists all transactions by that type
   */
  @Response<BadRequest>(400, 'Request was invalid')
  @Response<NotFound>(404, 'Item not found')
  @Get('/')
  public async getAllTransactions(
    @Query() apiType?: TransactionApiType,
    @Query() status?: TransactionState,
    @Query() updated_since?: DATE
  ): Promise<void> {
    const query: { state?: TransactionState; apiType?: TransactionApiType; updatedSince?: Date } = {
      state: status,
      apiType,
    }
    if (updated_since) {
      query.updatedSince = parseDateParam(updated_since)
    }

    return this.db.get('transaction', query)
  }

  /**
   * @summary Get a transaction by ID
   * @param id The transactions's identifier
   */
  @Response<NotFound>(404, 'Item not found')
  @Get('{id}')
  public async getTransaction(@Path() id: UUID): Promise<TransactionResponse> {
    const transaction = await this.db.get('transaction', { id }).then((transactions) => transactions[0])

    return transaction
  }
}
