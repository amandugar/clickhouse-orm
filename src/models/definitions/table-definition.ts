import { Field } from "../fields/base-field"

export interface BaseTableDefinition<T extends Record<string, unknown>> {
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
