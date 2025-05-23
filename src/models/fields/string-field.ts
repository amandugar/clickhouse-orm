import { BaseColumn } from '../column'
import { ModelType } from '../model'
import { Field } from './base-field'
import { StringFieldOptions, StringFieldTypes, FieldType } from './field-types'

export enum StringTypes {
  STRING = 'String',
  ENUM8 = 'Enum8',
  ENUM16 = 'Enum16',
}

export type StringColumn<T extends ModelType> = BaseColumn<T> & {
  type: StringTypes
  default?: string
  enumValues?: Record<string, number>
}

export class StringField extends Field {
  protected type: StringFieldTypes = StringFieldTypes.String

  constructor(options: StringFieldOptions) {
    super(options)
    this.type = options.type ?? StringFieldTypes.String
  }

  public getType(): FieldType | undefined {
    if (
      this.type === StringFieldTypes.Enum8 ||
      this.type === StringFieldTypes.Enum16
    ) {
      const enumValues = (this.options as StringFieldOptions).enumValues
      if (!enumValues || Object.keys(enumValues).length === 0) {
        throw new Error('Enum values are required for Enum type')
      }

      // Sort entries by numeric value
      const sortedEntries = Object.entries(enumValues)
        .sort(([, a], [, b]) => a - b)
        .map(([key, value]) => {
          // Escape single quotes in the key
          const escapedKey = key.replace(/'/g, "\\'")
          return `'${escapedKey}' = ${value}`
        })
        .join(', ')

      return `${this.type}(${sortedEntries})` as FieldType
    }
    return super.getType()
  }
}
