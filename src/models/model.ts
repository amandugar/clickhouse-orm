import { Field } from "./fields/base-field"
import { TableDefinition, FieldsOf } from "./definitions/table-definition"

export abstract class Model<T extends Record<string, unknown>> {
  protected static fields: FieldsOf<any> = {}
  protected static tableDefinition: TableDefinition<any>;
  [key: string]: any

  constructor(data: T) {
    const constructor = this.constructor as typeof Model<T>
    Object.keys(constructor["fields"] as Record<string, Field>).forEach(
      fieldName => {
        const field = constructor["fields"][fieldName]
        this[fieldName] =
          data[fieldName as keyof typeof data] !== undefined
            ? data[fieldName as keyof typeof data]
            : field.getOptions().defaultValue
      }
    )
  }

  public static init<T extends Record<string, unknown>>(): void {
    Object.entries(this.fields).forEach(([fieldName, field]) => {
      field.setName(fieldName)
    })

    if (!this.tableDefinition) {
      throw new Error("Table definition is required")
    }
  }

  public static createTableStatement<
    T extends Record<string, unknown>
  >(): string {
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

      return `${fieldName} ${type}${field.getMaterializedStatement()}${field.getDefaultValueStatement()}`
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

    return `CREATE TABLE ${tableName} (${columnsString}) ENGINE = ${engine} ${partitionByStatement} ${primaryKeyStatement} ${orderByStatement}`.trim()
  }
}
