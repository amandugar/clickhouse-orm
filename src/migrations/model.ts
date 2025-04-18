export interface BaseFieldOptions {
  expression?: string
  defaultValue?: string | number | boolean
}

export enum StringFieldTypes {
  String = "String",
}

export enum NumberFieldTypes {
  Int8 = "Int8",
  Int16 = "Int16",
  Int32 = "Int32",
  Int64 = "Int64",
}

export enum BooleanFieldTypes {
  Boolean = "Boolean",
}

export interface StringFieldOptions extends BaseFieldOptions {
  defaultValue?: string
  type?: StringFieldTypes
}

export interface NumberFieldOptions extends BaseFieldOptions {
  default?: number
  type?: NumberFieldTypes
}

export interface BooleanFieldOptions extends BaseFieldOptions {
  default?: boolean
  type?: BooleanFieldTypes
}

export type FieldOptions =
  | StringFieldOptions
  | NumberFieldOptions
  | BooleanFieldOptions

export type FieldType = StringFieldTypes | NumberFieldTypes | BooleanFieldTypes

export class Field {
  name: string = ""
  type?: FieldType
  options: FieldOptions = {}

  constructor(options: FieldOptions) {
    this.options = options
  }

  setName(name: string) {
    this.name = name
  }

  getName() {
    if (!this.name) {
      throw new Error("Name is required")
    }

    return this.name
  }
}

export class NumberField extends Field {
  type: NumberFieldTypes = NumberFieldTypes.Int32

  constructor(options: NumberFieldOptions) {
    super(options)
  }
}

export class StringField extends Field {
  type: StringFieldTypes = StringFieldTypes.String

  constructor(options: StringFieldOptions) {
    super(options)
  }
}

export class BooleanField extends Field {
  type: BooleanFieldTypes = BooleanFieldTypes.Boolean

  constructor(options: BooleanFieldOptions) {
    super(options)
  }
}

interface BaseTableDefinition<T extends Record<string, unknown>> {
  tableName: string
  orderBy: Extract<keyof T, string>[]
  partitionBy?: string
  primaryKey?: Extract<keyof T, string>[]
}

export interface MergeTreeTableDefinition<T extends Record<string, unknown>>
  extends BaseTableDefinition<T> {
  engine: "MergeTree"
}

export type TableDefinition<T extends Record<string, unknown>> =
  MergeTreeTableDefinition<T>

export type FieldsOf<T extends Record<string, unknown>> = {
  [K in keyof T]: Field
}

export abstract class Model<T extends Record<string, unknown>> {
  static fields: FieldsOf<any> = {}
  static tableDefinition: TableDefinition<any>;
  [key: string]: any

  constructor(data: T) {
    const constructor = this.constructor as typeof Model<T>
    Object.keys(constructor["fields"] as Record<string, Field>).forEach(
      fieldName => {
        const field = constructor["fields"][fieldName]
        this[fieldName] =
          data[fieldName as keyof typeof data] !== undefined
            ? data[fieldName as keyof typeof data]
            : field.options.defaultValue
      }
    )
  }

  static init<T extends Record<string, unknown>>() {
    Object.entries(this.fields).forEach(([fieldName, field]) => {
      field.setName(fieldName)
    })

    if (!this.tableDefinition) {
      throw new Error("Table definition is required")
    }
  }

  static createTableStatement<T extends Record<string, unknown>>() {
    const tableDefinition = this.tableDefinition
    const tableName = tableDefinition.tableName
    const orderBy = tableDefinition.orderBy
    const partitionBy = tableDefinition.partitionBy
    const engine = tableDefinition.engine
    const primaryKey = tableDefinition.primaryKey
    const columns = Object.keys(this.fields).map(fieldName => {
      const field = this.fields[fieldName]

      if (!field.type) {
        throw new Error("Type is required")
      }

      const materializedStatement = field.options.expression
        ? `MATERIALIZED ${field.options.expression}`
        : ""

      const defaultValueStatement = field.options.defaultValue
        ? ` DEFAULT ${field.options.defaultValue}`
        : ""

      return `${fieldName} ${field.type}${materializedStatement}${defaultValueStatement}`
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

    const createTableStatement =
      `CREATE TABLE ${tableName} (${columnsString}) ENGINE = ${engine} ${partitionByStatement} ${primaryKeyStatement} ${orderByStatement}`.trim()

    return createTableStatement
  }
}
