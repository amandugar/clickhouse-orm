import { Field } from './base-field'
import { ArrayFieldTypes, ArrayFieldOptions, FieldType } from './field-types'
import { BaseColumn } from '../column'
import { ModelType } from '../model'

export enum ArrayColumnTypes {
  Array = 'Array',
}

export type ArrayColumn<T extends ModelType> = BaseColumn<T> & {
  type: ArrayColumnTypes
  elementType: Field
  defaultValue?: T[]
}

export { ArrayFieldOptions }

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
