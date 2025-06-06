import { BaseFieldOptions, Field } from './base-field'

export enum StringFieldTypes {
  String = 'String',
  Enum8 = 'Enum8',
  Enum16 = 'Enum16',
}

export enum NumberFieldTypes {
  Int8 = 'Int8',
  Int16 = 'Int16',
  Int32 = 'Int32',
  Int64 = 'Int64',
  Float32 = 'Float32',
  Float64 = 'Float64',
}

export enum BooleanFieldTypes {
  Boolean = 'Boolean',
}

export enum TupleFieldTypes {
  Tuple = 'Tuple',
}

export enum ArrayFieldTypes {
  Array = 'Array',
}

export interface StringFieldOptions extends BaseFieldOptions {
  defaultValue?: string
  type?: StringFieldTypes
  enumValues?: Record<string, number>
}

export interface NumberFieldOptions extends BaseFieldOptions {
  default?: number
  type?: NumberFieldTypes
}

export interface BooleanFieldOptions extends BaseFieldOptions {
  default?: boolean
  type?: BooleanFieldTypes
}

export type PrimitiveValue = string | number | boolean | PrimitiveValue[]
export type TupleValue = PrimitiveValue | { [key: string]: TupleValue }

export type TupleType = Record<string, TupleValue>

export interface TupleFieldOptions<T extends TupleType = TupleType>
  extends BaseFieldOptions {
  defaultValue?: T
  type?: TupleFieldTypes
  fields: Record<string, Field>
}

export interface ArrayFieldOptions extends BaseFieldOptions {
  defaultValue?: PrimitiveValue[]
  type?: ArrayFieldTypes
  elementType: Field
}

export type FieldOptions =
  | StringFieldOptions
  | NumberFieldOptions
  | BooleanFieldOptions
  | TupleFieldOptions
  | ArrayFieldOptions

export type FieldType =
  | StringFieldTypes
  | NumberFieldTypes
  | BooleanFieldTypes
  | TupleFieldTypes
  | ArrayFieldTypes
