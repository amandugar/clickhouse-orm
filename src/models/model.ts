import { Field } from "./fields/base-field"
import { TableDefinition, FieldsOf } from "./definitions/table-definition"
import {
  ConnectionManager,
  ConnectionCredentials,
  ConnectionConfig,
} from "../utils/connection-manager"
import { ClickHouseClient } from "@clickhouse/client"

/**
 * @description
 * <T> is the type of the normal fields
 * <M> is the type of the materialized fields
 */
export abstract class Model<
  T extends Record<string, unknown>,
  M extends Record<string, unknown>
> {
  protected static fields: FieldsOf<any> = {}
  protected static tableDefinition: TableDefinition<any>

  constructor(data: T) {
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
}
