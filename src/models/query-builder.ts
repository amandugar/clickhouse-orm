import { DataRetrival } from './data-retrival'
import { Model } from './model'
import { ConnectionConfig } from '../utils/database/connection-manager'
import {
  ComparisonOperators,
  LogicalOperators,
  StringOperators,
  SetOperators,
  OperatorSuffix,
  LogicalOperator,
  ArithmeticOperators,
} from './operators'

type Operator =
  | ComparisonOperators
  | LogicalOperators
  | StringOperators
  | SetOperators
  | ArithmeticOperators

type Condition = {
  field: string
  operator: Operator
  value: any
  logicalOperator: LogicalOperator
  groupId?: number
  isNested?: boolean
  parentOperator?: LogicalOperator
}

type WithOperators<T> = {
  [K in keyof T as K extends string
    ? K | `${K}${Exclude<OperatorSuffix, '__in'>}`
    : never]: T[K]
} & {
  [K in keyof T as K extends string ? `${K}__in` : never]: T[K][]
}

const OPERATOR_MAP = {
  [ComparisonOperators.GT]: '>',
  [ComparisonOperators.LT]: '<',
  [ComparisonOperators.GTE]: '>=',
  [ComparisonOperators.LTE]: '<=',
  [ComparisonOperators.NE]: '!=',
  [StringOperators.ICONTAINS]: 'LIKE',
  [SetOperators.IN]: 'IN',
} as const

const LOOKUP_OPERATOR_MAP = {
  gt: '>',
  lt: '<',
  gte: '>=',
  lte: '<=',
  ne: '!=',
  icontains: 'LIKE',
  in: 'IN',
} as const

export class Q<T extends Record<string, unknown>> {
  public whereConditions: Condition[] = []
  private groupCounter: number = 0

  protected parseFieldAndOperator(field: string): {
    key: string
    operator: string
  } {
    const [key, lookup] = field.split('__')
    const operator = lookup ? LOOKUP_OPERATOR_MAP[lookup] || '=' : '='
    return { key, operator }
  }

  private parseConditionField(field: string, value: any): Condition {
    const { key, operator } = this.parseFieldAndOperator(field)
    const processedValue = operator === 'LIKE' ? `%${value}%` : value

    return {
      field: key,
      value: processedValue,
      operator: operator as Operator,
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

    const nestedConditions = entries.map(([field, value]) =>
      this.parseConditionField(field, value),
    )

    this.whereConditions.push({
      field: '',
      value: nestedConditions,
      operator: LogicalOperators.AND,
      isNested: true,
      logicalOperator,
      groupId,
    })
  }

  private addCondition(
    condition: Q<T> | WithOperators<Partial<T>>,
    logicalOperator: LogicalOperator,
    groupId: number,
  ) {
    if (condition instanceof Q) {
      this.whereConditions.push({
        field: '',
        value: condition.whereConditions,
        operator:
          condition.whereConditions[0]?.logicalOperator || LogicalOperators.AND,
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
    conditions:
      | Q<T>
      | WithOperators<Partial<T>>
      | Array<Q<T> | WithOperators<Partial<T>>>,
    logicalOperator: LogicalOperator,
  ) {
    const groupId = ++this.groupCounter
    if (Array.isArray(conditions)) {
      conditions.forEach((condition) =>
        this.addCondition(condition, logicalOperator, groupId),
      )
    } else {
      this.addCondition(conditions, logicalOperator, groupId)
    }
    return this
  }

  public and(
    conditions:
      | Q<T>
      | WithOperators<Partial<T>>
      | Array<Q<T> | WithOperators<Partial<T>>>,
  ) {
    return this.handleConditions(conditions, LogicalOperators.AND)
  }

  public or(
    conditions:
      | Q<T>
      | WithOperators<Partial<T>>
      | Array<Q<T> | WithOperators<Partial<T>>>,
  ) {
    return this.handleConditions(conditions, LogicalOperators.OR)
  }

  public not(conditions: Q<T> | WithOperators<Partial<T>>) {
    const groupId = ++this.groupCounter
    if (conditions instanceof Q) {
      this.whereConditions.push({
        field: '',
        value: conditions.whereConditions,
        operator:
          conditions.whereConditions[0]?.logicalOperator ||
          LogicalOperators.AND,
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

  protected buildBaseCondition(condition: Condition): string {
    if (condition.operator === SetOperators.IN) {
      const values = Array.isArray(condition.value)
        ? condition.value.length === 0
          ? '()'
          : `('${condition.value.join("', '")}')`
        : condition.value
      return `${condition.field} IN ${values}`
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
    operator: string
  } {
    const [key, lookup] = field.split('__')
    const operator = lookup ? LOOKUP_OPERATOR_MAP[lookup] || '=' : '='
    return { key, operator }
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

    const newConditions = Object.entries(conditions).map(([field, value]) =>
      this.parseFilterCondition(field, value),
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
      operator: ArithmeticOperators.NE,
      logicalOperator: LogicalOperators.AND,
    }))

    return this.clone({
      excludeConditions: [...this.excludeConditions, ...newConditions],
    })
  }

  private parseFilterCondition(field: string, value: any): Condition {
    const { key, operator } = this.parseFieldAndOperator(field)
    return {
      field: key,
      value: operator === 'LIKE' ? `%${value}%` : value,
      operator: operator as Operator,
      logicalOperator: LogicalOperators.AND,
    }
  }

  private buildCondition(condition: Condition, isNested = false): string {
    if (condition.isNested && Array.isArray(condition.value)) {
      const nestedConditions = condition.value
        .map((c) => this.buildCondition(c, true))
        .join(` ${condition.operator} `)

      const baseCondition =
        condition.operator === LogicalOperators.OR
          ? `(${nestedConditions})`
          : `(${nestedConditions})`

      return condition.logicalOperator === LogicalOperators.NOT
        ? `(NOT (${nestedConditions}))`
        : baseCondition
    }

    const baseCondition = this.buildBaseCondition(condition)
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
        .map((c) => this.buildCondition(c, true))
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

  protected buildBaseCondition(condition: Condition): string {
    if (condition.operator === SetOperators.IN) {
      const values = Array.isArray(condition.value)
        ? condition.value.length === 0
          ? '()'
          : `('${condition.value.join("', '")}')`
        : condition.value
      return `${condition.field} IN ${values}`
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
