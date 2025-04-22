import { FieldsOf } from '../types'
import { Field } from './base-field'
import { TupleFieldOptions, TupleFieldTypes } from './field-types'

export class TupleField<T extends Record<string, any>> extends Field {
  protected type: TupleFieldTypes = TupleFieldTypes.Tuple
  protected options: TupleFieldOptions<T>

  constructor(
    options: { fields: FieldsOf<T> } & Omit<TupleFieldOptions<T>, 'fields'>,
  ) {
    const defaultValue = {} as Record<string, any>
    Object.entries(options.fields).forEach(([key, field]) => {
      defaultValue[key] = field.getOptions().defaultValue
    })
    super({ ...options, defaultValue: defaultValue as T })
    this.options = { ...options, defaultValue: defaultValue as T }
    this.type = options.type ?? TupleFieldTypes.Tuple
  }

  public formatValue(value: T | undefined): string {
    if (!value) {
      return '()'
    }

    const formattedValues = Object.entries(this.options.fields).map(
      ([key, field]) => {
        const fieldValue = value[key]

        if (field instanceof TupleField) {
          return field.formatValue(fieldValue)
        }

        if (typeof fieldValue === 'string') {
          return `'${fieldValue}'`
        }

        return fieldValue
      },
    )

    return `(${formattedValues.join(', ')})`
  }
}
