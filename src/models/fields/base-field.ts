import {
  TupleFieldTypes,
  ArrayFieldTypes,
  TupleValue,
  PrimitiveValue,
  FieldType,
} from './field-types'

export type DefaultValue =
  | string
  | number
  | boolean
  | Record<string, TupleValue>
  | PrimitiveValue[]

export interface BaseFieldOptions {
  expression?: string
  defaultValue?: DefaultValue
}

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
    if (this.type === TupleFieldTypes.Tuple && 'fields' in this.options) {
      const tupleOptions = this.options as {
        fields: Record<string, Field>
      }

      const tupleType = `Tuple(${Object.values(tupleOptions.fields)
        .map((field) => `${field.getName()} ${field.getType()}`)
        .join(', ')})`

      return tupleType as FieldType
    }

    if (this.type === ArrayFieldTypes.Array && 'elementType' in this.options) {
      const arrayOptions = this.options as {
        elementType: Field
      }

      const arrayType = `Array(${arrayOptions.elementType.getType()})`
      return arrayType as FieldType
    }

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

  private _getDefaultValueStatement(value: DefaultValue): string {
    switch (typeof value) {
      case 'string':
        return `'${value}'`
      case 'number':
        return `${value}`
      case 'boolean':
        return `${value}`
      case 'object':
        if (Array.isArray(value)) {
          return `[${value.map((v) => this._getDefaultValueStatement(v)).join(', ')}]`
        }
        return `(${Object.values(value)
          .map((v) => this._getDefaultValueStatement(v))
          .join(', ')})`
    }
  }

  public getDefaultValue(): string | undefined {
    const defaultValue = this.options.defaultValue
    if (!defaultValue) return undefined

    let defaultValueStatement = ''
    if (Array.isArray(defaultValue)) {
      defaultValueStatement = `[${defaultValue.map((v) => this._getDefaultValueStatement(v)).join(', ')}]`
    } else {
      defaultValueStatement = this._getDefaultValueStatement(defaultValue)
    }

    return defaultValueStatement
  }
}
