/**
 * @fileoverview Query builder implementation for ClickHouse ORM
 *
 * This module provides a flexible and type-safe query builder for constructing
 * ClickHouse SQL queries. It supports:
 * - Complex filtering with AND/OR/NOT conditions
 * - Nested field queries
 * - Field projections
 * - Pagination (offset/limit)
 * - Type-safe field operations
 *
 * @example
 * ```typescript
 * const query = new QueryBuilder(UserModel)
 *   .filter({ name__contains: 'John', age__gt: 18 })
 *   .exclude({ status: 'inactive' })
 *   .limit(10)
 *   .offset(0);
 * ```
 *
 * @module query-builder
 */

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

/**
 * Represents a SQL or logical operator that can be used in query conditions
 */
type Operator = SqlOperators | LogicalOperators

/**
 * Represents a single condition in a WHERE clause
 * @property field - The database field name
 * @property operator - The operator to use for comparison
 * @property value - The value to compare against
 * @property logicalOperator - The logical operator (AND/OR/NOT) to combine with other conditions
 * @property groupId - Optional group identifier for grouping conditions
 * @property isNested - Whether this condition contains nested conditions
 * @property parentOperator - The logical operator of the parent condition if nested
 */
type Condition = {
  field: string
  operator: Operator
  value: any
  logicalOperator: LogicalOperator
  groupId?: number
  isNested?: boolean
  parentOperator?: LogicalOperator
}

/**
 * Represents possible condition types that can be used in query building
 * Can be a Q instance, an object with operators, or an array of either
 */
type Conditions<T extends Record<string, unknown>> =
  | Q<T>
  | WithOperators<Partial<T>>
  | Array<Q<T> | WithOperators<Partial<T>>>

/**
 * Type that allows field names to be suffixed with operator names
 * Enables syntax like { name__contains: 'John' } for LIKE queries
 */
type WithOperators<T> = {
  [K in keyof T as K extends string ? K | `${K}${OperatorSuffix}` : never]:
    | Partial<T[K]>
    | Partial<WithOperators<T[K]>>
    | Partial<T[K]>[]
}

/**
 * Base class providing common query building functionality
 * Handles parsing field names and operators, and formatting values
 */
class BaseQueryBuilder {
  /**
   * Parses a field name that may contain an operator suffix
   * @param field - Field name with optional operator suffix (e.g. "name__contains")
   * @returns Object containing the base field name and corresponding SQL operator
   */
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

  /**
   * Builds a basic SQL condition string from a Condition object
   * Handles special cases like IN, HAS_ANY, and NULL values
   * @param condition - The condition to convert to SQL
   * @returns SQL condition string
   */
  public buildBaseCondition(condition: Condition): string {
    if (condition.operator === SqlOperators.IN) {
      const values = Array.isArray(condition.value)
        ? condition.value.length === 0
          ? '(NULL)' // Handle empty array case
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

  /**
   * Formats a value for use in SQL queries
   * Handles strings, arrays, null/undefined, and other types
   * @param value - The value to format
   * @returns SQL-formatted value string
   */
  protected formatValue(value: any): string {
    if (value === undefined || value === null) return 'NULL'
    if (typeof value === 'string') return `'${value}'`
    if (Array.isArray(value)) {
      return value.length === 0
        ? '(NULL)' // Handle empty array case
        : `('${value.join("', '")}')`
    }
    return String(value)
  }
}

/**
 * Class for building complex query conditions using a fluent interface
 * Supports AND, OR, and NOT operations with nested conditions
 */
export class Q<T extends Record<string, unknown>> extends BaseQueryBuilder {
  public whereConditions: Condition[] = []
  private groupCounter: number = 0

  /**
   * Parses nested object conditions into a flat array of conditions
   * @param field - The base field name
   * @param value - The nested object containing conditions
   * @returns Array of parsed conditions
   */
  private parseNestedField(field: string, value: any): Condition[] {
    const processNestedObject = (obj: any, prefix: string): Condition[] => {
      const conditions: Condition[] = []
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

          conditions.push({
            field: actualField,
            value: processedValue,
            operator,
            logicalOperator: LogicalOperators.AND,
          })
        }
      })
      return conditions
    }

    const nestedConditions = processNestedObject(value, field)
    if (nestedConditions.length > 0) {
      return [
        {
          field: '',
          value: nestedConditions,
          operator: LogicalOperators.AND,
          isNested: true,
          logicalOperator: LogicalOperators.AND,
        },
      ]
    }
    return []
  }

  /**
   * Parses a single field condition
   * @param field - The field name with optional operator suffix
   * @param value - The value to compare against
   * @returns A Condition object
   */
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

  /**
   * Adds a condition to the whereConditions array
   * Handles both Q instances and plain objects
   * @param condition - The condition to add
   * @param logicalOperator - The logical operator to use
   * @param groupId - The group identifier
   */
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
      const entries = Object.entries(condition)
      const nestedConditions = entries.flatMap(([field, value]) =>
        typeof value === 'object' && value !== null && !Array.isArray(value)
          ? this.parseNestedField(field, value)
          : [this.parseConditionField(field, value)],
      )

      this.whereConditions.push({
        field: '',
        value: nestedConditions,
        operator:
          logicalOperator === LogicalOperators.NOT
            ? LogicalOperators.AND
            : logicalOperator,
        isNested: true,
        logicalOperator,
        groupId,
      })
    }
  }

  /**
   * Handles adding conditions with a specific logical operator
   * @param conditions - The conditions to add
   * @param logicalOperator - The logical operator to use
   * @returns The Q instance for chaining
   */
  private handleConditions(
    conditions: Conditions<T>,
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

  /**
   * Adds conditions using AND operator
   * @param conditions - The conditions to add
   * @returns The Q instance for chaining
   */
  public and(conditions: Conditions<T>) {
    return this.handleConditions(conditions, LogicalOperators.AND)
  }

  /**
   * Adds conditions using OR operator
   * @param conditions - The conditions to add
   * @returns The Q instance for chaining
   */
  public or(conditions: Conditions<T>) {
    return this.handleConditions(conditions, LogicalOperators.OR)
  }

  /**
   * Adds conditions using NOT operator
   * @param conditions - The conditions to negate
   * @returns The Q instance for chaining
   */
  public not(conditions: Q<T> | WithOperators<Partial<T>>) {
    return this.handleConditions(conditions, LogicalOperators.NOT)
  }
}

/**
 * Main query builder class that extends DataRetrival
 * Provides methods for building complex SQL queries with filtering, projection, and pagination
 * @template T - Type of the model's fields
 * @template M - Type of the model's methods
 */
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

  /**
   * Creates a new QueryBuilder instance
   * @param model - The model class to build queries for
   * @param options - Optional configuration for the query builder
   */
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

  /**
   * Creates a clone of the current QueryBuilder with updated options
   * @param options - The options to update in the clone
   * @returns A new QueryBuilder instance with the updated options
   */
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

  /**
   * Specifies which fields to select in the query
   * @param projects - Array of field names or field aliases
   * @returns A new QueryBuilder instance with the specified projection
   */
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

  /**
   * Sets the offset for pagination
   * @param offset - The number of records to skip
   * @returns A new QueryBuilder instance with the specified offset
   */
  public offset(offset: number): QueryBuilder<T, M> {
    return this.clone({ offset })
  }

  /**
   * Sets the limit for pagination
   * @param limit - The maximum number of records to return
   * @returns A new QueryBuilder instance with the specified limit
   */
  public limit(limit: number): QueryBuilder<T, M> {
    return this.clone({ limit })
  }

  /**
   * Parses a field name and its operator
   * @param field - The field name with optional operator suffix
   * @returns Object containing the base field name and corresponding SQL operator
   */
  protected parseFieldAndOperator(field: string): {
    key: string
    operator: SqlOperators
  } {
    return this.baseQueryBuilder.parseFieldAndOperator(field)
  }

  /**
   * Parses a filter condition from a field and value
   * @param field - The field name
   * @param value - The value to filter by
   * @returns A Condition object or array of conditions
   */
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

  /**
   * Adds filter conditions to the query
   * @param conditions - The conditions to filter by
   * @returns A new QueryBuilder instance with the added filter conditions
   */
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

  /**
   * Adds exclusion conditions to the query
   * @param conditions - The conditions to exclude
   * @returns A new QueryBuilder instance with the added exclusion conditions
   */
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

  /**
   * Builds a SQL condition string from a Condition object
   * @param condition - The condition to build
   * @returns SQL condition string
   */
  private buildCondition(condition: Condition): string {
    if (condition.isNested && Array.isArray(condition.value)) {
      const nestedConditions = condition.value
        .map((c) => this.buildCondition(c))
        .join(` ${condition.operator} `)

      const baseCondition = nestedConditions ? `(${nestedConditions})` : 'NULL'

      return condition.logicalOperator === LogicalOperators.NOT
        ? `(NOT ${baseCondition})`
        : baseCondition
    }

    const baseCondition = this.baseQueryBuilder.buildBaseCondition(condition)
    return condition.logicalOperator === LogicalOperators.NOT
      ? `(NOT (${baseCondition}))`
      : `(${baseCondition})`
  }

  /**
   * Builds the WHERE clause from an array of conditions
   * @param conditions - The conditions to build the WHERE clause from
   * @returns SQL WHERE clause string
   */
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

  /**
   * Builds the complete SQL query
   * @returns The complete SQL query string
   */
  public buildQuery(): string {
    const conditions = [...this.whereConditions, ...this.excludeConditions]
    const whereClause = this.buildWhereClause(conditions)

    return `SELECT ${this._project} FROM ${this.tableName}${
      whereClause ? ` WHERE ${whereClause}` : ''
    }${this._offset ? ` OFFSET ${this._offset}` : ''}${
      this._limit ? ` LIMIT ${this._limit}` : ''
    }`
  }

  /**
   * Gets the current SQL query
   * @returns The current SQL query string
   */
  public getQuery(): string {
    return this.buildQuery()
  }

  /**
   * Resets the query builder to its initial state
   * @returns A new QueryBuilder instance with default settings
   */
  public reset(): QueryBuilder<T, M> {
    return new QueryBuilder(this.model, {
      connectionConfig: this.connectionConfig,
    })
  }
}
