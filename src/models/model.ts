import { Field, FieldType } from "./fields/base-field"
import { TableDefinition, FieldsOf } from "./definitions/table-definition"
import {
  ConnectionManager,
  ConnectionCredentials,
  ConnectionConfig,
} from "../utils/connection-manager"
import { ClickHouseClient, Row } from "@clickhouse/client"
import { QueryBuilder } from "./query-builder"

/**
 * @description
 * <T> is the type of the normal fields
 * <M> is the type of the materialized fields
 */

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

/**
 * Here T stands for the normal fields
 * M stands for the materialized or virtual fields
 */

export abstract class Model<
  T extends Record<string, unknown>,
  M extends Record<string, unknown> = T
> {
  protected static fields: FieldsOf<any> = {}
  public static tableDefinition: TableDefinition<any>

  public objects: QueryBuilder<T, M>

  constructor(data?: Partial<T>) {
    if (data) {
      this.create(data)
    }
    const constructor = this.constructor as typeof Model<T, M>
    this.objects = new QueryBuilder<T, M>(constructor)
  }

  public values: Partial<T> = {}
  public create(data: Partial<T>) {
    const constructor = this.constructor as typeof Model<T, M>
    const processFields = (fields: Record<string, Field>) => {
      Object.keys(fields).forEach(fieldName => {
        const field = fields[fieldName]
        const key = fieldName as keyof T
        this.values[key] =
          data[key] !== undefined
            ? (data[key] as T[keyof T])
            : (field.getOptions().defaultValue as T[keyof T])
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
    const schema = this.generateSchema()
    const tableName = schema.tableName
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
    const partitionByStatement = schema.partitionBy
      ? `PARTITION BY ${schema.partitionBy}`
      : ""
    const primaryKeyStatement = schema.primaryKey
      ? `PRIMARY KEY (${schema.primaryKey.join(", ")})`
      : ""
    const orderByStatement =
      schema.orderBy && schema.orderBy.length > 0
        ? `ORDER BY (${schema.orderBy.join(", ")})`
        : ""

    return `CREATE TABLE IF NOT EXISTS ${tableName} (${columnsString}) ENGINE = ${schema.engine} ${partitionByStatement} ${primaryKeyStatement} ${orderByStatement}`.trim()
  }

  public static dropTableStatement(): string {
    return `DROP TABLE IF EXISTS ${this.tableDefinition.tableName}`
  }

  public static addColumnStatement(columns: Column[]): string {
    return `ALTER TABLE ${this.tableDefinition.tableName} ADD COLUMN ${columns
      .map(
        c =>
          `${c.name} ${c.type}${
            c.expression ? ` MATERIALIZED ${c.expression}` : ""
          }${c.default ? ` DEFAULT ${c.default}` : ""}`
      )
      .join(", ")}`
  }

  public static dropColumnStatement(columns: string[]): string {
    return `ALTER TABLE ${
      this.tableDefinition.tableName
    } DROP COLUMN ${columns.join(", ")}`
  }

  public static updateColumnStatement(columns: Column[]): string {
    return `ALTER TABLE ${
      this.tableDefinition.tableName
    } MODIFY COLUMN ${columns
      .map(
        c =>
          `${c.name} ${c.type}${
            c.expression ? ` MATERIALIZED ${c.expression}` : ""
          }${c.default ? ` DEFAULT ${c.default}` : ""}`
      )
      .join(", ")}`
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

  public static async withConnection<
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

    await constructor.withConnection(async client => {
      await client.insert({
        table: tableName,
        values: [this.values],
        format: "JSONEachRow",
      })
    })
  }
}
