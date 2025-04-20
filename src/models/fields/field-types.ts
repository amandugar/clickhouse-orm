import { BaseFieldOptions } from './base-field'

export enum StringFieldTypes {
  String = 'String',
}

export enum NumberFieldTypes {
  Int8 = 'Int8',
  Int16 = 'Int16',
  Int32 = 'Int32',
  Int64 = 'Int64',
}

export enum BooleanFieldTypes {
  Boolean = 'Boolean',
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
