import { Model } from "./model"

export abstract class DataRetrival<
  T extends Record<string, unknown>,
  M extends Record<string, unknown>
> {
  abstract buildQuery(): string
  abstract getQuery(): string
  model: typeof Model<T, M>

  constructor(model: typeof Model<T, M>) {
    this.model = model
  }

  public async *[Symbol.asyncIterator](): AsyncIterator<T> {
    this.buildQuery()
    const withConnection = await this.model.withConnection(async client => {
      return await client.query({
        query: this.getQuery(),
        format: "JSONEachRow",
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
