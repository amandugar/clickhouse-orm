import { BaseColumn } from '../column'
import { Field } from './base-field'
import { NumberFieldOptions, NumberFieldTypes } from './field-types'

export enum NumberTypes {
  INT_8 = 'Int8',
  INT_16 = 'Int16',
  INT_32 = 'Int32',
  INT_64 = 'Int64',
  UINT_8 = 'UInt8',
  UINT_16 = 'UInt16',
  UINT_32 = 'UInt32',
  UINT_64 = 'UInt64',
}

export type NumberColumn<T extends Record<string, unknown>> = BaseColumn<T> & {
  type: NumberTypes
  default?: number
}

export class NumberField extends Field {
  protected type: NumberFieldTypes = NumberFieldTypes.Int32

  constructor(options: NumberFieldOptions) {
    super(options)
    this.type = options.type ?? NumberFieldTypes.Int32
  }
}
