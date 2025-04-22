import { Engine } from '../../utils/engines/engines'
import { Field } from '../fields/base-field'
import { BooleanColumn } from '../fields/boolean-field'
import { NumberColumn } from '../fields/number-field'
import { StringColumn } from '../fields/string-field'

export type TableColumn<
  T extends Record<string, unknown> = Record<string, unknown>,
> = NumberColumn<T> | BooleanColumn<T> | StringColumn<T>

export interface ClickhouseTable<T extends Record<string, unknown>> {
  name: string
  partition: string
  engine: Engine
  primaryKeyId?: Extract<keyof T, string>[]
  orderBy?: Extract<keyof T, string>[]
  columns: TableColumn<T>[]
}

export interface BaseTableDefinition<T extends Record<string, unknown>> {
  tableName: string
  orderBy: Extract<keyof T, string>[]
  partitionBy?: string
  primaryKey?: Extract<keyof T, string>[]
}

export interface MergeTreeTableDefinition<T extends Record<string, unknown>>
  extends BaseTableDefinition<T> {
  engine: Engine
}

export type TableDefinition<T extends Record<string, unknown>> =
  MergeTreeTableDefinition<T>

export type FieldsOf<T extends Record<string, unknown>> = {
  [K in keyof T]: Field
}
