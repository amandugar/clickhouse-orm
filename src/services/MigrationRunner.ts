/**
 * @file MigrationRunner.ts
 * @description This file contains the MigrationRunner service class which provides functionality
 * for managing database schema migrations in ClickHouse. It handles table creation, modification,
 * and deletion operations, as well as column-level changes.
 *
 * The service supports:
 * - Creating new tables with custom schemas
 * - Dropping existing tables
 * - Adding new columns to tables
 * - Removing columns from tables
 * - Modifying existing columns
 *
 * @example
 * ```typescript
 * const runner = new MigrationRunner({
 *   host: 'localhost',
 *   port: 9000,
 *   username: 'default',
 *   password: ''
 * });
 *
 * await runner.createTable(schema);
 * await runner.addColumns('table_name', columns);
 * ```
 *
 * @author ClickHouse ORM Contributors
 * @license MIT
 */

import { ClickHouseClient } from '@clickhouse/client'
import { Schema } from '../models/model'
import { Column } from '../@types'
import {
  ConnectionCredentials,
  ConnectionManager,
} from '../utils/database/connection-manager'

/**
 * MigrationRunner is a service class that handles database schema migrations for ClickHouse.
 * It provides methods to create, modify, and drop tables and columns in a ClickHouse database.
 */
export class MigrationRunner {
  private connection: ConnectionManager

  /**
   * Creates a new instance of MigrationRunner with the specified database credentials.
   * @param credentials - Database connection credentials including host, port, username, and password
   */
  constructor(private readonly credentials: ConnectionCredentials) {
    const connectionManager = ConnectionManager.getInstance({
      credentials: this.credentials,
    })

    this.connection = connectionManager
  }

  /**
   * Generates a CREATE TABLE SQL statement based on the provided schema.
   * @param schema - The table schema containing columns, engine type, and other table properties
   * @returns A formatted SQL statement for creating a table
   */
  public static createTableStatement(schema: Schema): string {
    // Map each column to its SQL definition including type, materialized expressions, and default values
    const columns = schema.columns.map((column) => {
      let columnDef = `${column.name} ${this.getTypeString(column.type)}`
      const expression = column.expression
      if (expression) {
        columnDef += ` MATERIALIZED ${expression}`
      }
      if (column.default !== undefined && column.default !== '') {
        columnDef += ` DEFAULT ${column.default}`
      }
      return columnDef
    })

    const columnsString = columns.join(', ')
    // Add partition by clause if specified
    const partitionByStatement = schema.partitionBy
      ? `PARTITION BY ${schema.partitionBy}`
      : ''
    // Add primary key if specified
    const primaryKeyStatement = schema.primaryKey
      ? `PRIMARY KEY (${schema.primaryKey.join(', ')})`
      : ''
    // Add order by clause if specified
    const orderByStatement =
      schema.orderBy && schema.orderBy.length > 0
        ? `ORDER BY (${schema.orderBy.join(', ')})`
        : ''

    return `CREATE TABLE IF NOT EXISTS ${schema.tableName} (${columnsString}) ENGINE = ${schema.engine} ${partitionByStatement} ${primaryKeyStatement} ${orderByStatement}`.trim()
  }

  /**
   * Creates a new table in the database based on the provided schema.
   * @param schema - The table schema to create
   */
  public async createTable(schema: Schema): Promise<void> {
    const statement = MigrationRunner.createTableStatement(schema)
    await this.connection.with(async (client: ClickHouseClient) => {
      await client.exec({ query: statement })
    })
  }

  /**
   * Drops a table from the database if it exists.
   * @param tableName - The name of the table to drop
   */
  public async dropTable(tableName: string): Promise<void> {
    const statement = `DROP TABLE IF EXISTS ${tableName}`

    await this.connection.with(async (client: ClickHouseClient) => {
      await client.exec({ query: statement })
    })
  }

  /**
   * Adds new columns to an existing table.
   * @param tableName - The name of the table to modify
   * @param columns - Array of column definitions to add
   */
  public async addColumns(tableName: string, columns: Column[]): Promise<void> {
    const statement = `ALTER TABLE ${tableName} ADD COLUMN ${columns
      .map((c) => {
        const expression = c.expression
        return `${c.name} ${MigrationRunner.getTypeString(c.type)}${
          expression ? ` MATERIALIZED ${expression}` : ''
        }${c.default ? ` DEFAULT ${c.default}` : ''}`
      })
      .join(', ')}`

    await this.connection.with(async (client: ClickHouseClient) => {
      await client.exec({ query: statement })
    })
  }

  /**
   * Removes columns from an existing table.
   * @param tableName - The name of the table to modify
   * @param columns - Array of column names to remove
   */
  public async dropColumns(
    tableName: string,
    columns: string[],
  ): Promise<void> {
    const statement = `ALTER TABLE ${tableName} DROP COLUMN ${columns.join(
      ', ',
    )}`

    await this.connection.with(async (client: ClickHouseClient) => {
      await client.exec({ query: statement })
    })
  }

  /**
   * Modifies existing columns in a table.
   * @param tableName - The name of the table to modify
   * @param columns - Array of column definitions to update
   */
  public async updateColumns(
    tableName: string,
    columns: Column[],
  ): Promise<void> {
    const statement = `ALTER TABLE ${tableName} MODIFY COLUMN ${columns
      .map((c) => {
        const expression = c.expression
        return `${c.name} ${MigrationRunner.getTypeString(c.type)}${
          expression ? ` MATERIALIZED ${expression}` : ''
        }${c.default ? ` DEFAULT ${c.default}` : ''}`
      })
      .join(', ')}`

    await this.connection.with(async (client: ClickHouseClient) => {
      await client.exec({ query: statement })
    })
  }

  /**
   * Converts a column type to its string representation.
   * @param type - The column type to convert
   * @returns The string representation of the column type
   */
  private static getTypeString(type: Column['type']): string {
    if (typeof type === 'string') {
      return type
    }
    return String(type)
  }
}
