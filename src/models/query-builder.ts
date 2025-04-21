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
} from './operators'

type Operator =
  | '='
  | '!='
  | '>'
  | '<'
  | '>='
  | '<='
  | 'LIKE'
  | 'IN'
  | 'AND'
  | 'OR'
  | 'NOT'

type Condition = {
  field: string
  operator: Operator
  value: any
  logicalOperator: 'AND' | 'OR' | 'NOT'
  groupId?: number
  isNested?: boolean
  parentOperator?: 'AND' | 'OR' | 'NOT'
}

type WithOperators<T> = {
  [K in keyof T as K extends string
    ? K | `${K}${Exclude<OperatorSuffix, '__in'>}`
    : never]: T[K]
} & {
  [K in keyof T as K extends string ? `${K}__in` : never]: T[K][]
}

function parseCondition(
  field: string,
  value: any,
  logicalOperator: 'AND' | 'OR' | 'NOT' = 'AND',
): Condition {
  const [key, lookup] = field.split('__')

  const operatorMap: Record<string, Operator> = {
    gte: '>=',
    lte: '<=',
    gt: '>',
    lt: '<',
    icontains: 'LIKE',
    in: 'IN',
    ne: '!=',
  }

  const op: Operator = lookup ? operatorMap[lookup] || '=' : '='

  return {
    field: key,
    operator: op,
    value: op === 'LIKE' ? `%${value}%` : value,
    logicalOperator,
  }
}

export class Q<T extends Record<string, unknown>> {
  public whereConditions: Condition[] = []
  private groupCounter: number = 0

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
          condition.whereConditions[0].logicalOperator || LogicalOperators.AND,
        isNested: true,
        logicalOperator,
        groupId,
      })
    } else {
      const conditionEntries = Object.entries(condition)
      if (conditionEntries.length > 0) {
        const nestedConditions = conditionEntries.map(([field, value]) => {
          const [key, lookup] = field.split('__')
          const operator = lookup
            ? {
                [ComparisonOperators.GT]: '>',
                [ComparisonOperators.LT]: '<',
                [ComparisonOperators.GTE]: '>=',
                [ComparisonOperators.LTE]: '<=',
                [ComparisonOperators.NE]: '!=',
                [StringOperators.ICONTAINS]: 'LIKE',
                [SetOperators.IN]: 'IN',
              }[lookup as OperatorSuffix] || '='
            : '='

          return {
            field: key,
            value: operator === 'LIKE' ? `%${value}%` : value,
            operator: operator as Operator,
            logicalOperator: LogicalOperators.AND,
            groupId,
          }
        })

        this.whereConditions.push({
          field: '',
          value: nestedConditions,
          operator: LogicalOperators.AND,
          isNested: true,
          logicalOperator,
          groupId,
        })
      }
    }
  }

  public and(
    conditions:
      | Q<T>
      | WithOperators<Partial<T>>
      | Array<Q<T> | WithOperators<Partial<T>>>,
  ) {
    const groupId = ++this.groupCounter
    if (Array.isArray(conditions)) {
      conditions.forEach((condition) =>
        this.addCondition(condition, LogicalOperators.AND, groupId),
      )
    } else {
      this.addCondition(conditions, LogicalOperators.AND, groupId)
    }
    return this
  }

  public or(
    conditions:
      | Q<T>
      | WithOperators<Partial<T>>
      | Array<Q<T> | WithOperators<Partial<T>>>,
  ) {
    const groupId = ++this.groupCounter
    if (Array.isArray(conditions)) {
      conditions.forEach((condition) =>
        this.addCondition(condition, LogicalOperators.OR, groupId),
      )
    } else {
      this.addCondition(conditions, LogicalOperators.OR, groupId)
    }
    return this
  }

  public not(conditions: Q<T> | WithOperators<Partial<T>>) {
    const groupId = ++this.groupCounter
    if (conditions instanceof Q) {
      this.whereConditions.push({
        field: '',
        value: conditions.whereConditions,
        operator:
          conditions.whereConditions[0].logicalOperator || LogicalOperators.AND,
        isNested: true,
        logicalOperator: LogicalOperators.NOT,
        groupId,
      })
    } else {
      const conditionEntries = Object.entries(conditions)
      if (conditionEntries.length > 0) {
        const nestedConditions = conditionEntries.map(([field, value]) => {
          const [key, lookup] = field.split('__')
          const operator = lookup
            ? {
                [ComparisonOperators.GT]: '>',
                [ComparisonOperators.LT]: '<',
                [ComparisonOperators.GTE]: '>=',
                [ComparisonOperators.LTE]: '<=',
                [ComparisonOperators.NE]: '!=',
                [StringOperators.ICONTAINS]: 'LIKE',
                [SetOperators.IN]: 'IN',
              }[lookup as OperatorSuffix] || '='
            : '='

          return {
            field: key,
            value: operator === 'LIKE' ? `%${value}%` : value,
            operator: operator as Operator,
            logicalOperator: LogicalOperators.AND,
            groupId,
          }
        })

        this.whereConditions.push({
          field: '',
          value: nestedConditions,
          operator: LogicalOperators.AND,
          isNested: true,
          logicalOperator: LogicalOperators.NOT,
          groupId,
        })
      }
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
      if (typeof field === 'string') {
        return field
      }
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

    const newConditions = Object.entries(conditions).map(([field, value]) => {
      const [key, lookup] = field.split('__')
      const operator = lookup
        ? {
            gt: '>',
            lt: '<',
            gte: '>=',
            lte: '<=',
            ne: '!=',
            icontains: 'LIKE',
            in: 'IN',
          }[lookup] || '='
        : '='

      return {
        field: key,
        value: operator === 'LIKE' ? `%${value}%` : value,
        operator: operator as Operator,
        logicalOperator: 'AND' as 'AND' | 'OR' | 'NOT',
      }
    })

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
      operator: '!=' as Operator,
      logicalOperator: 'AND' as 'AND' | 'OR' | 'NOT',
    }))

    return this.clone({
      excludeConditions: [...this.excludeConditions, ...newConditions],
    })
  }

  private formatValue(value: any): string {
    if (value === undefined || value === null) return 'NULL'
    if (typeof value === 'string') return `'${value}'`
    if (Array.isArray(value)) {
      return value.map((v) => this.formatValue(v)).join(', ')
    }
    return String(value)
  }

  private buildCondition(condition: Condition): string {
    if (condition.isNested && Array.isArray(condition.value)) {
      const nestedConditions = condition.value
        .map((c) => this.buildCondition(c))
        .join(` ${condition.operator} `)
      return condition.logicalOperator === 'NOT'
        ? `NOT (${nestedConditions})`
        : `(${nestedConditions})`
    }

    if (condition.operator === 'IN') {
      const values = Array.isArray(condition.value)
        ? condition.value.map((v) => `'${v}'`).join(', ')
        : condition.value
      return condition.logicalOperator === 'NOT'
        ? `NOT (${condition.field} IN (${values}))`
        : `${condition.field} IN (${values})`
    }

    const baseCondition = `${condition.field} ${
      condition.operator
    } ${this.formatValue(condition.value)}`

    return condition.logicalOperator === 'NOT'
      ? `NOT (${baseCondition})`
      : baseCondition
  }

  public buildQuery(): string {
    const conditions = [...this.whereConditions, ...this.excludeConditions]
    if (conditions.length === 0) {
      return `SELECT ${this._project} FROM ${this.tableName}${
        this._offset ? ` OFFSET ${this._offset}` : ''
      }${this._limit ? ` LIMIT ${this._limit}` : ''}`
    }

    const groups = conditions.reduce(
      (acc, condition) => {
        const groupId = condition.groupId || 0
        if (!acc[groupId]) acc[groupId] = []
        acc[groupId].push(condition)
        return acc
      },
      {} as Record<number, Condition[]>,
    )

    const groupClauses = Object.values(groups).map((group) => {
      if (group.length === 1) {
        const condition = group[0]
        if (condition.isNested && Array.isArray(condition.value)) {
          const nestedConditions = condition.value
            .map((c) => this.buildCondition(c))
            .join(` ${condition.operator} `)
          return condition.logicalOperator === 'NOT'
            ? `NOT (${nestedConditions})`
            : `(${nestedConditions})`
        }
        return this.buildCondition(condition)
      }
      const clause = group
        .map((c) => this.buildCondition(c))
        .join(` ${group[0].logicalOperator} `)
      return `(${clause})`
    })

    const whereClause = groupClauses.join(' OR ')

    return `SELECT ${this._project} FROM ${
      this.tableName
    } WHERE (${whereClause})${this._offset ? ` OFFSET ${this._offset}` : ''}${
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
