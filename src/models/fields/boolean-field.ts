import { BaseColumn } from '../column'
import { Field } from './base-field'
import { BooleanFieldOptions, BooleanFieldTypes } from './field-types'
import { ModelType } from '../model'
export enum BooleanTypes {
  BOOLEAN = 'Boolean',
}

export type BooleanColumn<T extends ModelType> = BaseColumn<T> & {
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
