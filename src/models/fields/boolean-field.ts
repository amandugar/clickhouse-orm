import { BaseColumn } from '../column'
import { Field } from './base-field'
import { BooleanFieldOptions, BooleanFieldTypes } from './field-types'

export enum BooleanTypes {
  BOOLEAN = 'Boolean',
}

export type BooleanColumn<T extends Record<string, unknown>> = BaseColumn<T> & {
  type: BooleanTypes
  default?: boolean
}
export class BooleanField extends Field {
  protected type: BooleanFieldTypes = BooleanFieldTypes.Boolean

  constructor(options: BooleanFieldOptions) {
    super(options)
    this.type = options.type ?? BooleanFieldTypes.Boolean
  }
}
