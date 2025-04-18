import { Engine } from "../utils/engines"

export type BaseColumn<
  T extends Record<string, unknown> = Record<string, unknown>
> = {
  name: Extract<keyof T, string>
  /**
   * Optional expression makes it a materialized column when present
   */
  matExpression?: string
}

export type NumberColumn<T extends Record<string, unknown>> = BaseColumn<T> & {
  type: NumberTypes
  default?: number
}

export type BooleanColumn<T extends Record<string, unknown>> = BaseColumn<T> & {
  type: BooleanTypes
  default?: boolean
}

export type StringColumn<T extends Record<string, unknown>> = BaseColumn<T> & {
  type: StringTypes
  default?: string
}

export type Column<
  T extends Record<string, unknown> = Record<string, unknown>
> = NumberColumn<T> | BooleanColumn<T> | StringColumn<T>

export interface ClickhouseTable<T extends Record<string, unknown>> {
  name: string
  partition: string
  engine: Engine
  primaryKeyId?: Extract<keyof T, string>[]
  orderBy?: Extract<keyof T, string>[]
  columns: Column<T>[]
}
