import { Engine } from '../../utils/engines/engines'
import { ArrayColumn, TupleColumn } from '../fields'
import { Field } from '../fields/base-field'
import { BooleanColumn } from '../fields/boolean-field'
import { NumberColumn } from '../fields/number-field'
import { StringColumn } from '../fields/string-field'
import { ModelType } from '../model'

export type TableColumn<T extends ModelType> =
  | NumberColumn<T>
  | BooleanColumn<T>
  | StringColumn<T>
  | TupleColumn<T>
  | ArrayColumn<T>

export interface ClickhouseTable<T extends ModelType> {
  name: string
  partition: string
  engine: Engine
  primaryKeyId?: Extract<keyof T, string>[]
  orderBy?: Extract<keyof T, string>[]
  columns: TableColumn<T>[]
}

export interface BaseTableDefinition<T extends ModelType> {
  tableName: string
  orderBy: Extract<keyof T, string>[]
  partitionBy?: string
  primaryKey?: Extract<keyof T, string>[]
}

export interface MergeTreeTableDefinition<T extends ModelType>
  extends BaseTableDefinition<T> {
  engine: Engine
}

export type TableDefinition<T extends ModelType> = MergeTreeTableDefinition<T>

export type FieldsOf<T extends ModelType> = {
  [K in keyof T]: Field
}
