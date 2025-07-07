import {
  ConnectionConfig,
  ConnectionManager,
} from '../utils/database/connection-manager'
import { ModelType } from './model'
import { ClickHouseSettings } from '@clickhouse/client'

export abstract class DataRetrival<T extends ModelType> {
  abstract buildQuery(): string
  abstract getQuery(): string
  private _connectionConfig?: ConnectionConfig
  protected _settings?: ClickHouseSettings

  constructor(
    connectionConfig?: ConnectionConfig,
    settings?: ClickHouseSettings,
  ) {
    this._connectionConfig = connectionConfig
    this._settings = settings
  }

  public async *[Symbol.asyncIterator](): AsyncIterator<T> {
    this.buildQuery()
    const connectionManager = ConnectionManager.getDefaultOrCreate(
      this._connectionConfig,
    )
    const withConnection = await connectionManager.with(async (client) => {
      return await client.query({
        query: this.getQuery(),
        format: 'JSONEachRow',
        clickhouse_settings: {
          output_format_json_quote_64bit_floats: 1,
          output_format_json_quote_64bit_integers: 1,
          ...this._settings,
        },
      })
    })

    const stream = withConnection.stream()
    const iterator = stream[Symbol.asyncIterator]()

    for await (const row of iterator) {
      for (const column of row) {
        yield column.json() as T
      }
    }
  }

  private async toArray(): Promise<T[]> {
    const array: T[] = []

    for await (const row of this) {
      array.push(row)
    }

    return array
  }

  public async all(): Promise<T[]> {
    return this.toArray()
  }
}
