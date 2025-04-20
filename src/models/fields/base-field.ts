import {
  StringFieldTypes,
  NumberFieldTypes,
  BooleanFieldTypes,
} from './field-types'

export interface BaseFieldOptions {
  expression?: string
  defaultValue?: string | number | boolean
}

export type FieldType = StringFieldTypes | NumberFieldTypes | BooleanFieldTypes

export abstract class Field {
  protected name: string = ''
  protected type?: FieldType
  protected options: BaseFieldOptions = {}

  constructor(options: BaseFieldOptions) {
    this.options = options
  }

  public setName(name: string): void {
    this.name = name
  }

  public getName(): string {
    if (!this.name) {
      throw new Error('Name is required')
    }
    return this.name
  }

  public getType(): FieldType | undefined {
    return this.type
  }

  public getOptions(): BaseFieldOptions {
    return this.options
  }

  public getMaterializedStatement(): string {
    return this.options.expression
      ? `MATERIALIZED ${this.options.expression}`
      : ''
  }

  public getDefaultValueStatement(): string {
    return this.options.defaultValue
      ? `DEFAULT ${this.options.defaultValue}`
      : ''
  }
}
