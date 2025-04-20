import { Field } from './base-field'
import { NumberFieldOptions, NumberFieldTypes } from './field-types'

export class NumberField extends Field {
  protected type: NumberFieldTypes = NumberFieldTypes.Int32

  constructor(options: NumberFieldOptions) {
    super(options)
  }
}
