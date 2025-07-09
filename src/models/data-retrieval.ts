import {
  ConnectionConfig,
  ConnectionManager,
} from '../utils/database/connection-manager'
import { ModelType } from './model'
import { ClickHouseSettings } from '@clickhouse/client'

export abstract class DataRetrieval<T extends ModelType> {
  abstract buildQuery(): void
  abstract getQuery(): string

  private _connectionConfig?: ConnectionConfig
  protected _settings?: ClickHouseSettings
  private _iterator?: AsyncIterator<T>

  constructor(
    connectionConfig?: ConnectionConfig,
    settings?: ClickHouseSettings,
  ) {
    this._connectionConfig = connectionConfig
    this._settings = settings
  }

  public async next(): Promise<T | undefined> {
    if (!this._iterator) {
      this._iterator = this.createNewIterator()
    }

    const result = await this._iterator.next()
    return result.done ? undefined : result.value
  }

  public resetIterator(): void {
    this._iterator = undefined
  }

  public async *[Symbol.asyncIterator](): AsyncIterator<T> {
    this._iterator = this._iterator ?? this.createNewIterator()

    while (true) {
      const result = await this._iterator.next()
      if (result.done) break
      yield result.value
    }
  }

  private async *createNewIterator(): AsyncIterator<T> {
    this.buildQuery()
    const stream = await this.runQuery(this.getQuery())

    for await (const row of stream) {
      for (const column of row) {
        yield column.json() as T
      }
    }
  }

  public async all(): Promise<T[]> {
    const result: T[] = []
    for await (const item of this) {
      result.push(item)
    }
    return result
  }

  public async count(): Promise<number> {
    const countQuery = this.getQuery().replace(
      /^SELECT\s+.+?\s+FROM/i,
      'SELECT COUNT(*) as count FROM',
    )

    const stream = await this.runQuery(countQuery)

    for await (const row of stream) {
      for (const column of row) {
        return Number((column.json() as { count: string }).count || 0)
      }
    }

    return 0
  }

  private async runQuery(query: string) {
    const connectionManager = ConnectionManager.getDefaultOrCreate(
      this._connectionConfig,
    )

    const withConnection = await connectionManager.with(async (client) => {
      return await client.query({
        query,
        format: 'JSONEachRow',
        clickhouse_settings: {
          output_format_json_quote_64bit_floats: 0,
          output_format_json_quote_64bit_integers: 0,
          ...this._settings,
        },
      })
    })

    return withConnection.stream()[Symbol.asyncIterator]()
  }
}
