import { Model } from "./model"

type Condition = {
  field: string
  value: number | string | boolean
  operator: string
}

export class QueryBuilder<T extends Record<string, unknown>> {
  private tableName: string
  private whereConditions: Condition[] = []
  private excludeConditions: Condition[] = []
  private query: string = ""
  private model: typeof Model
  private _offset: number = 0
  private _limit: number | undefined = undefined
  private _project: string = "*"

  constructor(model: typeof Model) {
    this.tableName = model.tableDefinition.tableName
    this.query = `SELECT * FROM ${this.tableName}`
    this.model = model
  }

  public project<E extends Record<string, string>>(projects: (E & keyof T)[]) {
    let statements: string[] = []

    for (const field of projects) {
      let temp = ""
      if (typeof field === "string") {
        temp = `${field}`
      } else {
        temp = `${field.key} as ${field.value}`
      }
      statements.push(temp)
    }

    this._project = statements.join(", ")
    return this
  }

  public offset(offset: number) {
    this._offset = offset
    return this
  }

  public limit(limit: number) {
    this._limit = limit
    return this
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

    this.query = `SELECT ${this._project} FROM ${
      this.tableName
    } ${whereClause} ${this._offset ? `OFFSET ${this._offset}` : ""} ${
      this._limit ? `LIMIT ${this._limit}` : ""
    }`

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
