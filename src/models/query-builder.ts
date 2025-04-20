import { DataRetrival } from './data-retrival'
import { Model } from './model'
import { ConnectionConfig } from '../utils/connection-manager'

type Condition = {
  field: string
  value: number | string | boolean | Condition[]
  operator: string
  isNested?: boolean
  logicalOperator?: 'AND' | 'OR' | 'NOT'
  parentOperator?: 'AND' | 'OR' | 'NOT'
  groupId?: number
}

export class Q<T extends Record<string, unknown>> {
  public whereConditions: Condition[] = []
  private groupCounter: number = 0

  private addCondition(
    condition: Q<T> | Partial<T>,
    logicalOperator: 'AND' | 'OR' | 'NOT',
    groupId: number,
  ) {
    if (condition instanceof Q && condition.whereConditions.length > 0) {
      this.whereConditions.push({
        field: '',
        value: condition.whereConditions,
        operator: condition.whereConditions[0].logicalOperator || 'AND',
        isNested: true,
        logicalOperator,
        parentOperator: logicalOperator,
        groupId,
      })
    } else if (!(condition instanceof Q)) {
      Object.entries(condition).forEach(([field, value]) => {
        this.whereConditions.push({
          field,
          value: value as string | number | boolean,
          operator: '=',
          logicalOperator,
          parentOperator: logicalOperator,
          groupId,
        })
      })
    }
  }

  public and(conditions: Q<T> | Partial<T> | Array<Q<T> | Partial<T>>) {
    const groupId = ++this.groupCounter
    if (Array.isArray(conditions)) {
      conditions.forEach((condition) =>
        this.addCondition(condition, 'AND', groupId),
      )
    } else {
      this.addCondition(conditions, 'AND', groupId)
    }
    return this
  }

  public or(conditions: Q<T> | Partial<T> | Array<Q<T> | Partial<T>>) {
    const groupId = ++this.groupCounter
    if (Array.isArray(conditions)) {
      conditions.forEach((condition) =>
        this.addCondition(condition, 'OR', groupId),
      )
    } else {
      this.addCondition(conditions, 'OR', groupId)
    }
    return this
  }

  public not(conditions: Q<T> | Partial<T>) {
    const groupId = ++this.groupCounter
    this.addCondition(conditions, 'NOT', groupId)
    return this
  }
}

export class QueryBuilder<
  T extends Record<string, unknown>,
  M extends Record<string, unknown>,
> extends DataRetrival<T, M> {
  private tableName: string
  private whereConditions: Condition[] = []
  private excludeConditions: Condition[] = []
  private query: string = ''
  private _offset: number = 0
  private _limit: number | undefined = undefined
  private _project: string = '*'
  private connectionConfig?: ConnectionConfig

  constructor(model: typeof Model<T, M>, connectionConfig?: ConnectionConfig) {
    super(model)
    this.tableName = model.tableDefinition.tableName
    this.connectionConfig = connectionConfig
    this.query = `SELECT * FROM ${this.tableName}`
  }

  public project(
    projects: Array<keyof (T & M) | Record<keyof (T & M), string>>,
  ) {
    const statements = projects.map((field) => {
      if (typeof field === 'string') {
        return field
      }
      const [k, v] = Object.entries(field)[0]
      return `${k} as ${v}`
    })

    this._project = statements.join(', ')
    return this
  }

  public offset(offset: number) {
    this._offset = offset
    return this
  }

  public limit(limit: number) {
    this._limit = limit
    return this
  }

  public filter(conditions: Partial<T> | Q<T>) {
    if (conditions instanceof Q) {
      this.whereConditions.push(...conditions.whereConditions)
    } else {
      Object.entries(conditions).forEach(([field, value]) => {
        this.whereConditions.push({
          field,
          value,
          operator: '=',
          logicalOperator: 'AND',
        })
      })
    }
    return this
  }

  public exclude(conditions: Partial<T> | Q<T>) {
    if (conditions instanceof Q) {
      this.excludeConditions.push(...conditions.whereConditions)
    } else {
      Object.entries(conditions).forEach(([field, value]) => {
        this.excludeConditions.push({
          field,
          value,
          operator: '!=',
          logicalOperator: 'AND',
        })
      })
    }
    return this
  }

  private formatValue(value: any): string {
    if (typeof value === 'string') return `'${value}'`
    if (value === null) return 'NULL'
    return String(value)
  }

  private buildCondition(condition: Condition): string {
    if (condition.isNested && Array.isArray(condition.value)) {
      const nestedConditions = condition.value
        .map((c) => this.buildCondition(c))
        .join(` ${condition.operator} `)
      const nestedClause = `(${nestedConditions})`
      return condition.logicalOperator === 'NOT'
        ? `NOT ${nestedClause}`
        : nestedClause
    }
    const baseCondition = `${condition.field} ${
      condition.operator
    } ${this.formatValue(condition.value)}`
    return condition.logicalOperator === 'NOT'
      ? `NOT ${baseCondition}`
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
        const builtCondition = this.buildCondition(condition)
        return condition.logicalOperator === 'NOT'
          ? `(${builtCondition})`
          : builtCondition
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

  public setQuery() {
    this.query = this.buildQuery()
  }

  public reset(): void {
    this.whereConditions = []
    this.excludeConditions = []
    this.query = ''
  }

  public async *[Symbol.asyncIterator](): AsyncIterator<T> {
    this.setQuery()
    const withConnection = await this.model.withConnection(async (client) => {
      return await client.query({ query: this.query, format: 'JSONEachRow' })
    }, this.connectionConfig)

    const stream = withConnection.stream()
    for await (const row of stream) {
      for (const column of row) {
        yield column.json() as T
      }
    }
  }
}
