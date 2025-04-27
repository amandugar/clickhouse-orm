import { Field } from './fields/base-field'
import { TableDefinition, FieldsOf } from './types/table-definition'
import {
  ConnectionManager,
  ConnectionCredentials,
  ConnectionConfig,
} from '../utils/database/connection-manager'
import { ClickHouseClient } from '@clickhouse/client'
import { QueryBuilder } from './query-builder'
import { TupleField } from './fields/tuple-field'
import { FieldType, TupleFieldOptions } from './fields/field-types'

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

type NewModel = {
  type: 'CREATE'
  schema: Schema
}

type DropModel = {
  type: 'DROP'
  schema: { tableName: string }
}

type ExistingModel = {
  type: 'UPDATE'
  add?: Column[]
  remove?: string[]
  update?: Column[]
  tableName: string
}

type Change = NewModel | ExistingModel | DropModel

export type SchemaChange = {
  changes: Change
}

export type SchemaChanges = SchemaChange[]

/**
 * Here T stands for the normal fields
 * M stands for the materialized or virtual fields
 */

export interface ModelType {
  [key: string]: any
}

export abstract class Model<
  T extends ModelType = ModelType,
  M extends ModelType = ModelType,
> {
  protected static fields: FieldsOf<any> = {}
  public static tableDefinition: TableDefinition<any>
  public connectionConfig?: ConnectionConfig

  public objects: QueryBuilder<T, M>
  public values: Partial<T> = {}

  constructor(connectionConfig?: ConnectionConfig) {
    this.connectionConfig = connectionConfig
    const constructor = this.constructor as typeof Model<T, M>
    this.objects = new QueryBuilder<T, M>(constructor, {
      connectionConfig,
    })
  }

  public create(data: Partial<T>): this {
    const constructor = this.constructor as typeof Model<T, M>
    const processFields = (fields: Record<string, Field>) => {
      Object.keys(fields).forEach((fieldName) => {
        const field = fields[fieldName]
        const key = fieldName as keyof T
        this.values[key] =
          data[key] !== undefined
            ? (data[key] as T[keyof T])
            : (field.getOptions().defaultValue as T[keyof T])
      })
    }

    processFields(constructor['fields'])

    return this
  }

  public static init(): void {
    Object.entries(this.fields).forEach(([fieldName, field]) => {
      if (field instanceof TupleField) {
        const setFieldNamesRecursively = (field: Field, name: string) => {
          field.setName(name)
          if (field instanceof TupleField) {
            const tupleOptions = field.getOptions() as TupleFieldOptions
            Object.entries(tupleOptions.fields).forEach(
              ([nestedName, nestedField]) => {
                setFieldNamesRecursively(nestedField, nestedName)
              },
            )
          }
        }
        setFieldNamesRecursively(field, fieldName)
      } else {
        field.setName(fieldName)
      }
    })

    if (!this.tableDefinition) {
      throw new Error('Table definition is required')
    }
  }

  public static generateSchema(): Schema {
    const tableDefinition = this.tableDefinition
    const tableName = tableDefinition.tableName
    const columns: Column[] = Object.keys(this.fields).map((fieldName) => {
      const field = this.fields[fieldName]

      return {
        name: fieldName,
        type: field.getType() as FieldType,
        expression: field.getOptions().expression,
        default: field.getDefaultValue(),
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
    C extends ConnectionCredentials = ConnectionCredentials,
  >(
    operation: (client: ClickHouseClient) => Promise<R>,
    config?: ConnectionConfig<C>,
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

    await constructor.withConnection(async (client) => {
      await client.insert({
        table: tableName,
        values: [this.values],
        format: 'JSONEachRow',
      })
    }, this.connectionConfig)
  }
}
