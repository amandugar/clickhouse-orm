import { Model } from "./model"

type Condition = {
  field: string
  value: any
  operator: string
}

export class QueryBuilder<T extends Record<string, unknown>> {
  private tableName: string
  private whereConditions: Condition[] = []
  private excludeConditions: Condition[] = []
  private query: string = ""
  private model: typeof Model

  constructor(model: typeof Model) {
    this.tableName = model.tableDefinition.tableName
    this.query = `SELECT * FROM ${this.tableName}`
    this.model = model
  }

  public filter(conditions: Partial<T>) {
    Object.entries(conditions).forEach(([field, value]) => {
      this.whereConditions.push({
        field,
        value,
        operator: "=",
      })
    })
    return this
  }

  public exclude(conditions: Partial<T>) {
    Object.entries(conditions).forEach(([field, value]) => {
      this.excludeConditions.push({
        field,
        value,
        operator: "!=",
      })
    })
    return this
  }

  public buildQuery(): string {
    const conditions = [...this.whereConditions, ...this.excludeConditions]
    const values: Record<string, any> = {}

    const whereClause =
      conditions.length > 0
        ? "WHERE " +
          conditions
            .map(({ field, value, operator }, index) => {
              values[`val${index}`] = value
              if (typeof value === "string") {
                return `${field} ${operator} '${value}'`
              }
              return `${field} ${operator} ${value}`
            })
            .join(" AND ")
        : ""

    this.query = `SELECT * FROM ${this.tableName} ${whereClause}`
    return this.query
  }

  public getQuery(): string {
    return this.query
  }

  public reset(): void {
    this.whereConditions = []
    this.excludeConditions = []
    this.query = ""
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
