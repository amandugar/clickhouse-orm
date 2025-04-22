import { BaseColumn } from '../column'
import { ModelType } from '../model'
import { Field } from './base-field'
import { StringFieldOptions, StringFieldTypes } from './field-types'

export enum StringTypes {
  STRING = 'String',
}

export type StringColumn<T extends ModelType> = BaseColumn<T> & {
  type: StringTypes
  default?: string
}

export class StringField extends Field {
  protected type: StringFieldTypes = StringFieldTypes.String

  constructor(options: StringFieldOptions) {
    super(options)
    this.type = options.type ?? StringFieldTypes.String
  }
}
