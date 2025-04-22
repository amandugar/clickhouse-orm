import { FieldType } from '../models'

export type SchemaColumn = {
  name: string
  type: FieldType
  expression?: string
  default?: string | number | boolean
}
