import { DataRetrival } from './data-retrival'
import { Model } from './model'
import { ConnectionConfig } from '../utils/database/connection-manager'
import {
  FieldOperators,
  LogicalOperators,
  OperatorSuffix,
  LogicalOperator,
  SqlOperators,
  FIELD_TO_SQL_OPERATOR,
} from './operators'

type Operator = SqlOperators | LogicalOperators

type Condition = {
  field: string
  operator: Operator
  value: any
  logicalOperator: LogicalOperator
  groupId?: number
  isNested?: boolean
  parentOperator?: LogicalOperator
}

type Conditions<T extends Record<string, unknown>> =
  | Q<T>
  | WithOperators<Partial<T>>
  | Array<Q<T> | WithOperators<Partial<T>>>

type WithOperators<T> = {
  [K in keyof T as K extends string ? K | `${K}${OperatorSuffix}` : never]:
    | T[K]
    | T[K][]
}

class BaseQueryBuilder {
  public parseFieldAndOperator(field: string): {
    key: string
    operator: SqlOperators
  } {
    const [fieldName, lookup] = field.split('__')
    const fieldOperator = lookup
      ? (`__${lookup}` as FieldOperators)
      : FieldOperators.EQ
    const operator = FIELD_TO_SQL_OPERATOR[fieldOperator] || SqlOperators.EQ
    return { key: fieldName, operator }
  }

  public buildBaseCondition(condition: Condition): string {
    if (condition.operator === SqlOperators.IN) {
      const values = Array.isArray(condition.value)
        ? condition.value.length === 0
          ? '()'
          : `('${condition.value.join("', '")}')`
        : condition.value
      return `${condition.field} IN ${values}`
    }

    if (condition.operator === SqlOperators.HAS_ANY) {
      const values = Array.isArray(condition.value)
        ? condition.value.length === 0
          ? '[]'
          : `['${condition.value.join("', '")}']`
        : condition.value
      return `hasAny(${condition.field}, ${values})`
    }

    if (condition.value === null || condition.value === undefined) {
      return `${condition.field} IS NULL`
    }

    return `${condition.field} ${condition.operator} ${this.formatValue(condition.value)}`
  }

  protected formatValue(value: any): string {
    if (value === undefined || value === null) return 'NULL'
    if (typeof value === 'string') return `'${value}'`
    if (Array.isArray(value)) {
      return value.length === 0 ? '()' : `('${value.join("', '")}')`
    }
    return String(value)
  }
}

export class Q<T extends Record<string, unknown>> extends BaseQueryBuilder {
  public whereConditions: Condition[] = []
  private groupCounter: number = 0

  private parseNestedField(field: string, value: any): Condition[] {
    const conditions: Condition[] = []

    const processNestedObject = (obj: any, prefix: string) => {
      const nestedConditions: Condition[] = []
      Object.entries(obj).forEach(([key, val]) => {
        if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
          const childConditions = processNestedObject(val, `${prefix}.${key}`)
          if (childConditions.length > 0) {
            conditions.push({
              field: '',
              value: childConditions,
              operator: LogicalOperators.AND,
              isNested: true,
              logicalOperator: LogicalOperators.AND,
            })
          }
        } else {
          const { key: fieldName, operator } = this.parseFieldAndOperator(key)
          const actualField = prefix ? `${prefix}.${fieldName}` : fieldName

          let processedValue = val
          if (operator === SqlOperators.LIKE) {
            processedValue = `%${val}%`
          } else if (operator === SqlOperators.IN) {
            processedValue = Array.isArray(val) ? val : [val]
          }

          nestedConditions.push({
            field: actualField,
            value: processedValue,
            operator,
            logicalOperator: LogicalOperators.AND,
          })
        }
      })
      return nestedConditions
    }

    const nestedConditions = processNestedObject(value, field)
    if (nestedConditions.length > 0) {
      conditions.push({
        field: '',
        value: nestedConditions,
        operator: LogicalOperators.AND,
        isNested: true,
        logicalOperator: LogicalOperators.AND,
      })
    }

    return conditions
  }

  private parseConditionField(field: string, value: any): Condition {
    const { key, operator } = this.parseFieldAndOperator(field)
    const processedValue = operator === SqlOperators.LIKE ? `%${value}%` : value

    return {
      field: key,
      value: processedValue,
      operator,
      logicalOperator: LogicalOperators.AND,
      groupId: this.groupCounter,
    }
  }

  private addNestedConditions(
    entries: [string, any][],
    logicalOperator: LogicalOperator,
    groupId: number,
  ) {
    if (entries.length === 0) return

    const nestedConditions = entries.flatMap(([field, value]) => {
      if (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
      ) {
        return this.parseNestedField(field, value)
      }
      return [this.parseConditionField(field, value)]
    })

    if (logicalOperator === LogicalOperators.NOT) {
      // For NOT operations, we need to preserve the AND relationship between conditions because the NOT operator is applied to the entire condition
      this.whereConditions.push({
        field: '',
        value: nestedConditions,
        operator: LogicalOperators.AND,
        isNested: true,
        logicalOperator: LogicalOperators.NOT,
        groupId,
      })
    } else {
      this.whereConditions.push({
        field: '',
        value: nestedConditions,
        operator: logicalOperator,
        isNested: true,
        logicalOperator,
        groupId,
      })
    }
  }

  private addCondition(
    condition: Q<T> | WithOperators<Partial<T>>,
    logicalOperator: LogicalOperator,
    groupId: number,
  ) {
    if (condition instanceof Q) {
      const operator =
        condition.whereConditions[0]?.logicalOperator || LogicalOperators.AND
      this.whereConditions.push({
        field: '',
        value: condition.whereConditions,
        operator,
        isNested: true,
        logicalOperator,
        groupId,
      })
    } else {
      this.addNestedConditions(
        Object.entries(condition),
        logicalOperator,
        groupId,
      )
    }
  }

  private handleConditions(
    conditions: Conditions<T>,
    logicalOperator: LogicalOperator,
  ) {
    const groupId = ++this.groupCounter
    if (Array.isArray(conditions)) {
      conditions.forEach((condition) => {
        if (condition instanceof Q) {
          // For Q instances in an array, we need to preserve their internal operator
          this.addCondition(condition, logicalOperator, groupId)
        } else {
          // For plain objects, use the parent logical operator
          this.addNestedConditions(
            Object.entries(condition),
            logicalOperator,
            groupId,
          )
        }
      })
    } else {
      if (conditions instanceof Q) {
        this.addCondition(conditions, logicalOperator, groupId)
      } else {
        // Handle nested objects in Q class
        const nestedConditions = Object.entries(conditions).flatMap(
          ([field, value]) => {
            if (
              typeof value === 'object' &&
              value !== null &&
              !Array.isArray(value)
            ) {
              return this.parseNestedField(field, value)
            }
            return [this.parseConditionField(field, value)]
          },
        )

        this.whereConditions.push({
          field: '',
          value: nestedConditions,
          operator: logicalOperator,
          isNested: true,
          logicalOperator,
          groupId,
        })
      }
    }
    return this
  }

  public and(conditions: Conditions<T>) {
    return this.handleConditions(conditions, LogicalOperators.AND)
  }

  public or(conditions: Conditions<T>) {
    return this.handleConditions(conditions, LogicalOperators.OR)
  }

  public not(conditions: Q<T> | WithOperators<Partial<T>>) {
    const groupId = ++this.groupCounter
    if (conditions instanceof Q) {
      // Preserve the original operator in NOT operations
      const operator =
        conditions.whereConditions[0]?.logicalOperator || LogicalOperators.AND
      this.whereConditions.push({
        field: '',
        value: conditions.whereConditions,
        operator,
        isNested: true,
        logicalOperator: LogicalOperators.NOT,
        groupId,
      })
    } else {
      this.addNestedConditions(
        Object.entries(conditions),
        LogicalOperators.NOT,
        groupId,
      )
    }
    return this
  }
}

export class QueryBuilder<
  T extends Record<string, unknown>,
  M extends Record<string, unknown>,
> extends DataRetrival<T, M> {
  private readonly tableName: string
  private readonly whereConditions: Condition[] = []
  private readonly excludeConditions: Condition[] = []
  private readonly _offset: number = 0
  private readonly _limit: number | undefined = undefined
  private readonly _project: string = '*'
  private readonly connectionConfig?: ConnectionConfig
  private readonly baseQueryBuilder: BaseQueryBuilder

  constructor(
    model: typeof Model<T, M>,
    options: {
      whereConditions?: Condition[]
      excludeConditions?: Condition[]
      offset?: number
      limit?: number
      project?: string
      connectionConfig?: ConnectionConfig
    } = {},
  ) {
    super(model)
    this.tableName = model.tableDefinition.tableName
    this.whereConditions = options.whereConditions || []
    this.excludeConditions = options.excludeConditions || []
    this._offset = options.offset || 0
    this._limit = options.limit
    this._project = options.project || '*'
    this.connectionConfig = options.connectionConfig
    this.baseQueryBuilder = new BaseQueryBuilder()
  }

  private clone(
    options: Partial<ConstructorParameters<typeof QueryBuilder>[1]>,
  ): QueryBuilder<T, M> {
    return new QueryBuilder(this.model, {
      whereConditions: this.whereConditions,
      excludeConditions: this.excludeConditions,
      offset: this._offset,
      limit: this._limit,
      project: this._project,
      connectionConfig: this.connectionConfig,
      ...options,
    })
  }

  public project(
    projects: Array<keyof (T & M) | Record<keyof (T & M), string>>,
  ): QueryBuilder<T, M> {
    const statements = projects.map((field) => {
      if (typeof field === 'string') return field
      const [k, v] = Object.entries(field)[0]
      return `${k} as ${v}`
    })

    return this.clone({ project: statements.join(', ') })
  }

  public offset(offset: number): QueryBuilder<T, M> {
    return this.clone({ offset })
  }

  public limit(limit: number): QueryBuilder<T, M> {
    return this.clone({ limit })
  }

  protected parseFieldAndOperator(field: string): {
    key: string
    operator: SqlOperators
  } {
    return this.baseQueryBuilder.parseFieldAndOperator(field)
  }

  private parseFilterCondition(
    field: string,
    value: any,
  ): Condition | Condition[] {
    const { key, operator } = this.parseFieldAndOperator(field)

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const conditions: Condition[] = []

      const processNestedObject = (obj: any, prefix: string) => {
        Object.entries(obj).forEach(([key, val]) => {
          const { key: fieldName, operator } = this.parseFieldAndOperator(key)
          const fullField = prefix ? `${prefix}.${fieldName}` : fieldName
          if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
            processNestedObject(val, fullField)
          } else {
            let processedValue = val
            if (operator === SqlOperators.LIKE) {
              processedValue = `%${val}%`
            } else if (operator === SqlOperators.IN) {
              processedValue = Array.isArray(val) ? val : [val]
            }

            conditions.push({
              field: fullField,
              value: processedValue,
              operator,
              logicalOperator: LogicalOperators.AND,
            })
          }
        })
      }

      processNestedObject(value, key)
      return conditions
    }

    let processedValue = value
    if (operator === SqlOperators.LIKE) {
      processedValue = `%${value}%`
    } else if (operator === SqlOperators.IN) {
      processedValue = Array.isArray(value) ? value : [value]
    }

    return {
      field: key,
      value: processedValue,
      operator,
      logicalOperator: LogicalOperators.AND,
    }
  }

  public filter(
    conditions: WithOperators<Partial<T>> | Q<T>,
  ): QueryBuilder<T, M> {
    if (conditions instanceof Q) {
      return this.clone({
        whereConditions: [
          ...this.whereConditions,
          ...conditions.whereConditions,
        ],
      })
    }

    const newConditions = Object.entries(conditions).flatMap(
      ([field, value]) => {
        const condition = this.parseFilterCondition(field, value)
        return Array.isArray(condition) ? condition : [condition]
      },
    )

    return this.clone({
      whereConditions: [...this.whereConditions, ...newConditions],
    })
  }

  public exclude(conditions: Partial<T> | Q<T>): QueryBuilder<T, M> {
    if (conditions instanceof Q) {
      return this.clone({
        excludeConditions: [
          ...this.excludeConditions,
          ...conditions.whereConditions,
        ],
      })
    }

    const newConditions = Object.entries(conditions).map(([field, value]) => ({
      field,
      value,
      operator: SqlOperators.NE,
      logicalOperator: LogicalOperators.AND,
    }))

    return this.clone({
      excludeConditions: [...this.excludeConditions, ...newConditions],
    })
  }

  private buildCondition(condition: Condition): string {
    if (condition.isNested && Array.isArray(condition.value)) {
      const nestedConditions = condition.value
        .map((c) => this.buildCondition(c))
        .join(` ${condition.operator} `)

      const baseCondition = `(${nestedConditions})`

      return condition.logicalOperator === LogicalOperators.NOT
        ? `(NOT (${nestedConditions}))`
        : baseCondition
    }

    const baseCondition = this.baseQueryBuilder.buildBaseCondition(condition)
    return condition.logicalOperator === LogicalOperators.NOT
      ? `(NOT (${baseCondition}))`
      : `(${baseCondition})`
  }

  private buildWhereClause(conditions: Condition[]): string {
    if (conditions.length === 0) return ''

    const groups = conditions.reduce(
      (acc, condition) => {
        const groupId = condition.groupId || 0
        if (!acc[groupId]) {
          acc[groupId] = []
        }
        acc[groupId].push(condition)
        return acc
      },
      {} as Record<number, Condition[]>,
    )

    const groupClauses = Object.values(groups).map((group) => {
      if (group.length === 1) {
        return this.buildCondition(group[0])
      }

      return `(${group
        .map((c) => this.buildCondition(c))
        .join(` ${group[0].logicalOperator} `)})`
    })

    const whereClause =
      groupClauses.length > 1
        ? `(${groupClauses.join(' OR ')})`
        : groupClauses[0]

    return whereClause
  }

  public buildQuery(): string {
    const conditions = [...this.whereConditions, ...this.excludeConditions]
    const whereClause = this.buildWhereClause(conditions)

    return `SELECT ${this._project} FROM ${this.tableName}${
      whereClause ? ` WHERE ${whereClause}` : ''
    }${this._offset ? ` OFFSET ${this._offset}` : ''}${
      this._limit ? ` LIMIT ${this._limit}` : ''
    }`
  }

  public getQuery(): string {
    return this.buildQuery()
  }

  public reset(): QueryBuilder<T, M> {
    return new QueryBuilder(this.model, {
      connectionConfig: this.connectionConfig,
    })
  }
}
