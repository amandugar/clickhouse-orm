import { Field, FieldType } from "./fields/base-field"
import { TableDefinition, FieldsOf } from "./definitions/table-definition"
import {
  ConnectionManager,
  ConnectionCredentials,
  ConnectionConfig,
} from "../utils/connection-manager"
import { ClickHouseClient, Row } from "@clickhouse/client"

/**
 * @description
 * <T> is the type of the normal fields
 * <M> is the type of the materialized fields
 */

type FindOptions<T extends Record<string, unknown>> = {
  where: {
    [K in keyof T]?: T[K]
  }
  projection?: (keyof T)[]
}

type Column = {
  name: string
  type: FieldType
  expression?: string
  default?: string | number | boolean
}

export type Schema = {
  tableName: string
  columns: Column[]
  engine: string
  orderBy?: string[]
  partitionBy?: string
  primaryKey?: string[]
}

type NewModel<
  T extends Record<string, unknown>,
  M extends Record<string, unknown>
> = {
  type: "CREATE"
  schema: Schema
}

type DropModel = {
  type: "DROP"
  schema: { tableName: string }
}

type ExistingModel = {
  type: "UPDATE"
  add?: Column[]
  remove?: string[]
  update?: Column[]
  tableName: string
}

type Change<
  T extends Record<string, unknown>,
  M extends Record<string, unknown>
> = NewModel<T, M> | ExistingModel | DropModel

export type SchemaChange<
  T extends Record<string, unknown>,
  M extends Record<string, unknown>
> = {
  changes: Change<T, M>
}

export type SchemaChanges<
  T extends Record<string, unknown>,
  M extends Record<string, unknown>
> = SchemaChange<T, M>[]

export abstract class Model<
  T extends Record<string, unknown>,
  M extends Record<string, unknown> = T
> {
  protected static fields: FieldsOf<any> = {}
  protected static tableDefinition: TableDefinition<any>

  constructor(data?: T) {
    if (data) {
      this.create(data)
    }
  }

  public create(data: T) {
    const constructor = this.constructor as typeof Model<T, M>
    const processFields = (fields: Record<string, Field>) => {
      Object.keys(fields).forEach(fieldName => {
        const field = fields[fieldName]
        this[fieldName] =
          data[fieldName as keyof typeof data] !== undefined
            ? data[fieldName as keyof typeof data]
            : field.getOptions().defaultValue
      })
    }

    processFields(constructor["fields"])

    return this
  }

  public static init(): void {
    Object.entries(this.fields).forEach(([fieldName, field]) => {
      field.setName(fieldName)
    })

    if (!this.tableDefinition) {
      throw new Error("Table definition is required")
    }
  }

  public static createTableStatement(): string {
    const tableDefinition = this.tableDefinition
    const tableName = tableDefinition.tableName
    const orderBy = tableDefinition.orderBy
    const partitionBy = tableDefinition.partitionBy
    const engine = tableDefinition.engine
    const primaryKey = tableDefinition.primaryKey

    const columns = Object.keys(this.fields).map(fieldName => {
      const field = this.fields[fieldName]
      const type = field.getType()

      if (!type) {
        throw new Error("Type is required")
      }

      let column = `${fieldName} ${type}`

      if (field.getMaterializedStatement()) {
        column += " " + field.getMaterializedStatement()
      }

      if (field.getDefaultValueStatement()) {
        column += " " + field.getDefaultValueStatement()
      }

      return column
    })

    const columnsString = columns.join(", ")
    const partitionByStatement = partitionBy
      ? `PARTITION BY ${partitionBy}`
      : ""
    const primaryKeyStatement = primaryKey
      ? `PRIMARY KEY (${primaryKey.join(", ")})`
      : ""
    const orderByStatement =
      orderBy.length > 0 ? `ORDER BY (${orderBy.join(", ")})` : ""

    return `CREATE TABLE IF NOT EXISTS ${tableName} (${columnsString}) ENGINE = ${engine} ${partitionByStatement} ${primaryKeyStatement} ${orderByStatement}`.trim()
  }

  public static createTable(): void {
    const tableStatement = this.createTableStatement()
    this.withConnection(client => client.exec({ query: tableStatement }))
  }

  public static generateSchema(): Schema {
    const tableDefinition = this.tableDefinition
    const tableName = tableDefinition.tableName
    const columns: Column[] = Object.keys(this.fields).map(fieldName => {
      const field = this.fields[fieldName]
      return {
        name: fieldName,
        type: field.getType() as FieldType,
        expression: field.getOptions().expression,
        default: field.getOptions().defaultValue,
      }
    })

    return {
      tableName,
      columns,
      engine: tableDefinition.engine,
      orderBy: tableDefinition.orderBy,
      partitionBy: tableDefinition.partitionBy,
      primaryKey: tableDefinition.primaryKey,
    }
  }

  protected static async withConnection<
    R,
    C extends ConnectionCredentials = ConnectionCredentials
  >(
    operation: (client: ClickHouseClient) => Promise<R>,
    config?: ConnectionConfig<C>
  ): Promise<R> {
    const connectionManager = config
      ? ConnectionManager.getInstance<C>(config)
      : ConnectionManager.getDefault()
    return connectionManager.with(operation)
  }

  public async save(): Promise<void> {
    const constructor = this.constructor as typeof Model
    const tableDefinition = constructor.tableDefinition
    const tableName = tableDefinition.tableName

    // Get only the regular fields (excluding materialized fields)
    const regularFields = Object.keys(constructor.fields).filter(
      fieldName => !constructor.fields[fieldName].getMaterializedStatement()
    )

    // Get the values for the regular fields
    const values = regularFields.map(fieldName => {
      const value = this[fieldName as keyof this]
      if (value === undefined) {
        return "DEFAULT"
      }
      if (typeof value === "string") {
        return `'${value}'`
      }
      return value
    })

    const query = `INSERT INTO ${tableName} (${regularFields.join(
      ", "
    )}) VALUES (${values.join(", ")})`

    await constructor.withConnection(async client => {
      await client.exec({
        query,
      })
    })
  }
  public async find(options: FindOptions<T>) {
    const constructor = this.constructor as typeof Model
    const tableDefinition = constructor.tableDefinition
    const tableName = tableDefinition.tableName

    const values: Record<string, any> = {}
    const whereClause =
      options.where && Object.keys(options.where).length > 0
        ? "WHERE " +
          Object.entries(options.where)
            .map(([key, value], index) => {
              values[`val${index}`] = value
              return `${key} = {val${index}:String}`
            })
            .join(" AND ")
        : ""

    const selectClause = options.projection
      ? `SELECT ${options.projection.join(", ")}`
      : "SELECT *"

    const query = `${selectClause} FROM ${tableName} ${whereClause}`

    const result = await constructor.withConnection(async client => {
      return await client.query({
        query,
        format: "JSONEachRow",
        query_params: values,
      })
    })

    const stream = result.stream()
    const iterator = stream[Symbol.asyncIterator]() // This converts the stream to an iterator

    return {
      async next(): Promise<Row<T, "JSONEachRow">[] | null> {
        const { value, done } = await iterator.next()
        if (done) return null
        return value
      },

      async toArray(): Promise<Row<T, "JSONEachRow">[]> {
        const rows: Row<T, "JSONEachRow">[] = []
        for await (const row of stream) {
          rows.push(...row)
        }
        return rows
      },
    }
  }

  public findAll() {
    return this.find({ where: {} })
  }
}
