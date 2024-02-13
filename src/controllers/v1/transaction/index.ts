import { Controller, Get, Route, Path, Response, Tags, Security, Query } from 'tsoa'
import type { Logger } from 'pino'
import { injectable } from 'tsyringe'

import { logger } from '../../../lib/logger.js'
import Database from '../../../lib/db/index.js'
import type { DATE, UUID } from '../../../models/strings.js'
import { BadRequest, NotFound } from '../../../lib/error-handler/index.js'
import type {
  TransactionApiType,
  GetTransactionResponse,
  ListTransactionResponse,
  TransactionState,
} from '../../../models/transaction.js'
import { Where } from '../../../lib/db/types.js'

@injectable()
@Route('v1/transaction')
@Tags('transaction')
@Security('BearerAuth')
export class TransactionController extends Controller {
  log: Logger

  constructor(private db: Database) {
    super()
    this.log = logger.child({ controller: '/transaction' })
  }

  /**
   * Returns the details of all transactions.
   * @summary List transactions
   * @Query api_type lists all transactions by that type
   */
  @Response<BadRequest>(400, 'Request was invalid')
  @Response<NotFound>(404, 'Item not found')
  @Get('/')
  public async get(
    @Query() api_type?: TransactionApiType,
    @Query() state?: TransactionState,
    @Query() created_after?: DATE,
    @Query() updated_after?: DATE
  ): Promise<ListTransactionResponse> {
    const where: Where<'transaction'> = [
      {
        state,
        api_type,
      },
    ]
    if (created_after) where.push(['created_at', '>=', new Date(created_after)])
    if (updated_after) where.push(['updated_at', '>=', new Date(updated_after)])

    return this.db.get('transaction', where)
  }

  /**
   * @summary Get a transaction by ID
   * @param id The transactions's identifier
   */
  @Response<NotFound>(404, 'Item not found')
  @Get('{id}')
  public async getById(@Path() id: UUID): Promise<GetTransactionResponse> {
    const [transaction] = await this.db.get('transaction', { id })
    if (!transaction) throw new NotFound(`transaction [${id}]`)

    return transaction
  }
}
