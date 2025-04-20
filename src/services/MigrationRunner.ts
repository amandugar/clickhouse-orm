import { ClickHouseClient } from "@clickhouse/client"
import { Schema } from "../models/model"
import { Column } from "../@types"
import {
  ConnectionCredentials,
  ConnectionManager,
} from "../utils/connection-manager"

export class MigrationRunner {
  private connection: ConnectionManager

  constructor(private readonly credentials: ConnectionCredentials) {
    const connectionManager = ConnectionManager.getInstance({
      credentials: this.credentials,
    })

    this.connection = connectionManager
  }

  public static createTableStatement(schema: Schema): string {
    const columns = schema.columns.map(column => {
      let columnDef = `${column.name} ${this.getTypeString(column.type)}`
      const expression = column.expression
      if (expression) {
        columnDef += ` MATERIALIZED ${expression}`
      }
      if (column.default !== undefined) {
        columnDef += ` DEFAULT ${column.default}`
      }
      return columnDef
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

    return `CREATE TABLE IF NOT EXISTS ${schema.tableName} (${columnsString}) ENGINE = ${schema.engine} ${partitionByStatement} ${primaryKeyStatement} ${orderByStatement}`.trim()
  }

  public async createTable(schema: Schema): Promise<void> {
    const statement = MigrationRunner.createTableStatement(schema)
    await this.connection.with(async (client: ClickHouseClient) => {
      await client.exec({ query: statement })
    })
  }

  public async dropTable(tableName: string): Promise<void> {
    const statement = `DROP TABLE IF EXISTS ${tableName}`

    await this.connection.with(async (client: ClickHouseClient) => {
      await client.exec({ query: statement })
    })
  }

  public async addColumns(tableName: string, columns: Column[]): Promise<void> {
    const statement = `ALTER TABLE ${tableName} ADD COLUMN ${columns
      .map(c => {
        const expression = c.expression
        return `${c.name} ${MigrationRunner.getTypeString(c.type)}${
          expression ? ` MATERIALIZED ${expression}` : ""
        }${c.default ? ` DEFAULT ${c.default}` : ""}`
      })
      .join(", ")}`

    await this.connection.with(async (client: ClickHouseClient) => {
      await client.exec({ query: statement })
    })
  }

  public async dropColumns(
    tableName: string,
    columns: string[]
  ): Promise<void> {
    const statement = `ALTER TABLE ${tableName} DROP COLUMN ${columns.join(
      ", "
    )}`

    await this.connection.with(async (client: ClickHouseClient) => {
      await client.exec({ query: statement })
    })
  }

  public async updateColumns(
    tableName: string,
    columns: Column[]
  ): Promise<void> {
    const statement = `ALTER TABLE ${tableName} MODIFY COLUMN ${columns
      .map(c => {
        const expression = c.expression
        return `${c.name} ${MigrationRunner.getTypeString(c.type)}${
          expression ? ` MATERIALIZED ${expression}` : ""
        }${c.default ? ` DEFAULT ${c.default}` : ""}`
      })
      .join(", ")}`

    await this.connection.with(async (client: ClickHouseClient) => {
      await client.exec({ query: statement })
    })
  }

  private static getTypeString(type: Column["type"]): string {
    if (typeof type === "string") {
      return type
    }
    return String(type)
  }
}
