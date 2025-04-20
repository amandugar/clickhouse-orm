import { Field } from './base-field'
import { StringFieldOptions, StringFieldTypes } from './field-types'

export class StringField extends Field {
  protected type: StringFieldTypes = StringFieldTypes.String

  constructor(options: StringFieldOptions) {
    super(options)
  }
}
