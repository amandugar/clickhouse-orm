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
  private _iterator?: AsyncIterator<T>

  constructor(
    connectionConfig?: ConnectionConfig,
    settings?: ClickHouseSettings,
  ) {
    this._connectionConfig = connectionConfig
    this._settings = settings
  }

  /**
   * Returns the next element from the data stream
   * @returns Promise resolving to the next element or undefined if no more elements
   */
  public async next(): Promise<T | undefined> {
    if (!this._iterator) {
      this._iterator = this.createNewIterator()
    }

    const result = await this._iterator.next()
    return result.done ? undefined : result.value
  }

  /**
   * Resets the iterator state, allowing the stream to be re-read from the beginning
   */
  public resetIterator(): void {
    this._iterator = undefined
  }

  public async *[Symbol.asyncIterator](): AsyncIterator<T> {
    // If we already have an iterator from next(), use it
    if (this._iterator) {
      // Create a new generator that yields from the existing iterator
      while (true) {
        const result = await this._iterator.next()
        if (result.done) {
          break
        }
        yield result.value
      }
      return
    }

    // Otherwise, create a new iterator and store it
    this._iterator = this.createNewIterator()

    // Create a new generator that yields from the stored iterator
    while (true) {
      const result = await this._iterator.next()
      if (result.done) {
        break
      }
      yield result.value
    }
  }

  private async *createNewIterator(): AsyncIterator<T> {
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
