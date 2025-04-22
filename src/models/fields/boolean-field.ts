import { Field } from './base-field'
import { BooleanFieldOptions, BooleanFieldTypes } from './field-types'

export class BooleanField extends Field {
  protected type: BooleanFieldTypes = BooleanFieldTypes.Boolean

  constructor(options: BooleanFieldOptions) {
    super(options)
    this.type = options.type ?? BooleanFieldTypes.Boolean
  }
}
