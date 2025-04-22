import { FieldType } from '../models/fields/base-field'

export type SchemaColumn = {
  name: string
  type: FieldType
  expression?: string
  default?: string | number | boolean
}
