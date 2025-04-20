import { FieldType } from '../fields/base-field'

export type Column = {
  name: string
  type: FieldType
  expression?: string
  default?: string | number | boolean
}
