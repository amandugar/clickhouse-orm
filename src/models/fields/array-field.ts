import { Field } from './base-field'
import { ArrayFieldTypes, ArrayFieldOptions, FieldType } from './field-types'

export class ArrayField extends Field {
  protected type: FieldType = ArrayFieldTypes.Array

  constructor(options: ArrayFieldOptions) {
    super(options)
  }

  public getType(): FieldType | undefined {
    const arrayOptions = this.options as ArrayFieldOptions
    return `Array(${arrayOptions.elementType.getType()})` as FieldType
  }
}
