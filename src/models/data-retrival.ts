import {
  ConnectionConfig,
  ConnectionManager,
} from '../utils/database/connection-manager'
import { ModelType } from './model'

export abstract class DataRetrival<T extends ModelType> {
  abstract buildQuery(): string
  abstract getQuery(): string
  private _connectionConfig?: ConnectionConfig

  constructor(connectionConfig?: ConnectionConfig) {
    this._connectionConfig = connectionConfig
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

  private async toArray() {
    const array: T[] = []

    for await (const row of this) {
      array.push(row)
    }

    return array
  }

  public async all() {
    return this.toArray()
  }
}
