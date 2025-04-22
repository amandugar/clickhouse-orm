import { BaseColumn } from '../column'
import { Field } from './base-field'
import { StringFieldOptions, StringFieldTypes } from './field-types'

export enum StringTypes {
  STRING = 'String',
}

export type StringColumn<T extends Record<string, unknown>> = BaseColumn<T> & {
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
