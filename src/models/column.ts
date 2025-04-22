import { ModelType } from './model'

export type BaseColumn<T extends ModelType> = {
  name: Extract<keyof T, string>
  /**
   * Optional expression makes it a materialized column when present
   */
  expression?: string
}
