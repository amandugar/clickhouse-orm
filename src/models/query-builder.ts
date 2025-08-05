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

import { DataRetrieval } from './data-retrieval'
import { Model, ModelType } from './model'
import { ConnectionConfig } from '../utils/database/connection-manager'
import {
  FieldOperators,
  LogicalOperators,
  OperatorSuffix,
  LogicalOperator,
  SqlOperators,
  FIELD_TO_SQL_OPERATOR,
} from './operators'
import { Engine } from '../utils'
import { ConnectionManager } from '../utils/database/connection-manager'
import { AggregationOperator, AggregationResult } from './aggregation'
import { ClickHouseSettings } from '@clickhouse/client'

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
type Conditions<T extends ModelType> =
  | Q<T>
  | WithOperators<Partial<T>>
  | Array<Q<T> | WithOperators<Partial<T>>>

/**
 * Type for nested sorting that allows sorting by nested fields
 * Supports both simple field sorting and nested field sorting
 */
type NestedSortData = Partial<Record<string, -1 | 1 | any>>

/**
 * Type that allows field names to be suffixed with operator names
 * Enables syntax like { name__contains: 'John' } for LIKE queries
 */
export type WithOperators<T> = {
  [K in keyof T as K extends string ? K | `${K}${OperatorSuffix}` : never]:
    | Partial<T[K]>
    | Partial<WithOperators<T[K]>>
    | Partial<T[K]>[]
    | QueryBuilder<any, any>
}

export type Project<T extends ModelType> = Array<
  keyof T | Partial<Record<keyof T, string>> | { [key: string]: string }
>

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
      if (condition.value instanceof QueryBuilder) {
        // If the value is a QueryBuilder instance, use its buildQuery method
        return `${condition.field} IN (${condition.value.buildQuery()})`
      }

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
export class Q<T extends ModelType> extends BaseQueryBuilder {
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
 * Main query builder class that extends DataRetrieval
 * Provides methods for building complex SQL queries with filtering, projection, and pagination
 * @template T - Type of the model's fields
 * @template M - Type of the model's methods
 */
export class QueryBuilder<
  T extends ModelType,
  M extends ModelType = ModelType,
> extends DataRetrieval<T> {
  private readonly tableName: string
  private readonly engine: Engine
  private readonly whereConditions: Condition[] = []
  private readonly excludeConditions: Condition[] = []
  private readonly _offset: number = 0
  private readonly _limit: number | undefined = undefined
  private _project: string = '*'
  private readonly connectionConfig?: ConnectionConfig
  private readonly baseQueryBuilder: BaseQueryBuilder
  private _final: boolean = false
  private _model: typeof Model
  private _sort: NestedSortData | undefined = undefined
  /**
   * Creates a new QueryBuilder instance
   * @param model - The model class to build queries for
   * @param options - Optional configuration for the query builder
   */
  constructor(
    model: typeof Model,
    options: {
      whereConditions?: Condition[]
      excludeConditions?: Condition[]
      offset?: number
      limit?: number
      project?: string
      connectionConfig?: ConnectionConfig
      _sort?: NestedSortData
    } = {},
  ) {
    super(options.connectionConfig)
    this._model = model
    this.tableName = model.tableDefinition.tableName
    this.engine = model.tableDefinition.engine
    this.whereConditions = options.whereConditions || []
    this.excludeConditions = options.excludeConditions || []
    this._offset = options.offset || 0
    this._limit = options.limit
    this._project = options.project || '*'
    this.connectionConfig = options.connectionConfig
    this._sort = options._sort || {}
    this.baseQueryBuilder = new BaseQueryBuilder()
  }

  /**
   * Creates a clone of the current QueryBuilder with updated options
   * @param options - The options to update in the clone
   * @returns A new QueryBuilder instance with the updated options
   */
  private clone<NewM extends ModelType>(
    options: Partial<ConstructorParameters<typeof QueryBuilder>[1]>,
  ): QueryBuilder<T, NewM> {
    return new QueryBuilder<T, NewM>(this._model, {
      whereConditions: this.whereConditions,
      excludeConditions: this.excludeConditions,
      offset: this._offset,
      limit: this._limit,
      project: this._project,
      connectionConfig: this.connectionConfig,
      _sort: this._sort,
      ...options,
    } as ConstructorParameters<typeof QueryBuilder<T, NewM>>[1])
  }

  /**
   * Specifies which fields to select in the query
   * @param projects - Array of field names or field aliases
   * @returns A new QueryBuilder instance with the specified projection
   */
  public project(projects: Project<T>): QueryBuilder<T, M> {
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
   * @param field - The field name with optional operator suffix (e.g. "name__contains")
   * @param value - The value to filter by, can be a primitive value, array, or nested object
   * @returns A Condition object for simple conditions or array of conditions for nested objects
   * @description
   * This method handles both simple and nested filter conditions. For simple conditions,
   * it creates a single Condition object. For nested objects, it recursively processes
   * the nested structure to create multiple conditions.
   */
  private parseFilterCondition(
    field: string,
    value: any,
  ): Condition | Condition[] {
    const { key, operator } = this.parseFieldAndOperator(field)

    if (!this.isNestedObject(value)) {
      return this.createSimpleCondition(key, value, operator)
    }

    const conditions: Condition[] = []
    this.processNestedObject(value, key, conditions)
    return conditions
  }

  /**
   * Checks if a value is a nested object that needs recursive processing
   * @param value - The value to check
   * @returns boolean indicating if the value is a nested object
   * @description
   * Determines if a value is a plain object (not null, array, or QueryBuilder instance)
   * that contains nested filter conditions.
   */
  private isNestedObject(value: any): boolean {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      !(value instanceof QueryBuilder)
    )
  }

  /**
   * Recursively processes a nested object to extract filter conditions
   * @param obj - The nested object to process
   * @param prefix - The field name prefix for nested fields
   * @param conditions - Array to collect the resulting conditions
   * @description
   * Processes each key-value pair in the object. For nested objects, it recursively
   * processes them with an updated field prefix. For simple values, it creates
   * conditions with the appropriate field name and processed value.
   */
  private processNestedObject(
    obj: any,
    prefix: string,
    conditions: Condition[],
  ): void {
    Object.entries(obj).forEach(([key, val]) => {
      const { key: fieldName, operator } = this.parseFieldAndOperator(key)
      const fullField = prefix ? `${prefix}.${fieldName}` : fieldName

      if (this.isNestedObject(val)) {
        this.processNestedObject(val, fullField, conditions)
      } else {
        const processedValue = this.processValue(val, operator)
        conditions.push({
          field: fullField,
          value: processedValue,
          operator,
          logicalOperator: LogicalOperators.AND,
        })
      }
    })
  }

  /**
   * Processes a value based on the operator type
   * @param value - The value to process
   * @param operator - The SQL operator being used
   * @returns The processed value appropriate for the operator
   * @description
   * Handles special cases for different operators:
   * - LIKE: Wraps value in % for pattern matching
   * - IN: Handles arrays and QueryBuilder instances
   * - Other operators: Returns value as-is
   */
  private processValue(value: any, operator: SqlOperators): any {
    if (operator === SqlOperators.LIKE) {
      return `%${value}%`
    }
    if (operator === SqlOperators.IN) {
      if (value instanceof QueryBuilder) {
        return value
      }
      if (Array.isArray(value)) {
        return value
      }
      return [value]
    }
    return value
  }

  /**
   * Creates a simple condition object
   * @param field - The field name
   * @param value - The value to filter by
   * @param operator - The SQL operator to use
   * @returns A Condition object with the specified parameters
   * @description
   * Creates a basic condition object with the given field, processed value,
   * operator, and default AND logical operator.
   */
  private createSimpleCondition(
    field: string,
    value: unknown,
    operator: SqlOperators,
  ): Condition {
    return {
      field,
      value: this.processValue(value, operator),
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

  public settings(settings: ClickHouseSettings): QueryBuilder<T, M> {
    this._settings = settings
    return this
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

    const buildSort = () => {
      if (!this._sort || Object.keys(this._sort).length === 0) return ''

      const flattenedSort = this.flattenSortData(this._sort)
      return ` ORDER BY ${Object.entries(flattenedSort)
        .map(
          ([field, direction]) =>
            `${field} ${direction === -1 ? 'DESC' : 'ASC'}`,
        )
        .join(', ')}`
    }

    let query = `SELECT ${this._project} FROM ${this.tableName} ${
      this._final ? `FINAL ` : ''
    }`

    if (whereClause) {
      query += `WHERE ${whereClause}`
    }

    query += buildSort()
    if (this._limit) query += ` LIMIT ${this._limit}`
    if (this._offset) query += ` OFFSET ${this._offset}`

    return query
  }

  /**
   * Gets the current SQL query
   * @returns The current SQL query string
   */
  public getQuery(): string {
    return this.buildQuery()
  }

  public final(): QueryBuilder<T, M> {
    if (this.engine !== Engine.REPLACING_MERGE_TREE) {
      throw new Error('Final is only supported for ReplacingMergeTree engine')
    }

    this._final = true
    return this
  }

  public async first(): Promise<T | undefined> {
    const results = await this.limit(1)
      .settings(this._settings || {})
      .all()
    return results[0] || undefined
  }

  /**
   * Deletes records matching the current query conditions
   * @returns A boolean indicating whether the delete operation was successful
   */
  public async delete(): Promise<boolean> {
    const conditions = [...this.whereConditions, ...this.excludeConditions]
    const whereClause = this.buildWhereClause(conditions)

    const query = `DELETE FROM ${this.tableName} ${
      whereClause ? `WHERE ${whereClause}` : ''
    }`

    const connectionManager = ConnectionManager.getDefaultOrCreate(
      this.connectionConfig,
    )
    try {
      await connectionManager.with(async (client) => {
        await client.exec({ query })
      })
      return true
    } catch (error) {
      console.error(error)
      return false
    }
  }

  /**
   * Resets the query builder to its initial state
   * @returns A new QueryBuilder instance with default settings
   */
  public reset(): QueryBuilder<T, M> {
    return new QueryBuilder(this._model, {
      connectionConfig: this.connectionConfig,
    })
  }

  /**
   * Recursively flattens nested sort data into a flat object with dot notation
   * @param sortData - The nested sort data to flatten
   * @param prefix - The current field prefix
   * @returns Flattened sort data with dot notation keys
   */
  private flattenSortData(
    sortData: NestedSortData,
    prefix: string = '',
  ): Record<string, -1 | 1> {
    const flattened: Record<string, -1 | 1> = {}

    for (const [key, value] of Object.entries(sortData)) {
      const fieldPath = prefix ? `${prefix}.${key}` : key

      if (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
      ) {
        // Check if it's a nested object with sort direction
        if (typeof value === 'number' && (value === -1 || value === 1)) {
          flattened[fieldPath] = value
        } else {
          // Recursively flatten nested object
          const nestedFlattened = this.flattenSortData(
            value as NestedSortData,
            fieldPath,
          )
          Object.assign(flattened, nestedFlattened)
        }
      } else {
        // Direct sort direction
        flattened[fieldPath] = value as -1 | 1
      }
    }

    return flattened
  }

  public sort(sortData: NestedSortData): QueryBuilder<T, M> {
    return this.clone({
      _sort: {
        ...this._sort,
        ...sortData,
      },
    })
  }

  /**
   * Performs aggregation operations on the query results
   * @param aggregations - Object mapping aliases to aggregation operators
   * @returns Promise resolving to the aggregation results
   * @example
   * ```typescript
   * const result = await Sale.objects
   *   .filter({ price__gt: 100 })
   *   .aggregate({
   *     total_revenue: new Sum('price'),
   *     avg_price: new Avg('price')
   *   })
   * // { total_revenue: 1500, avg_price: 250 }
   * ```
   */
  public aggregate<P extends Record<string, AggregationOperator>>(
    aggregations: P,
  ): QueryBuilder<T, AggregationResult<P>> {
    const aggregationSql = Object.entries(aggregations)
      .map(([key, agg]) => {
        // Use the alias if provided, otherwise use the key
        const alias = agg.alias || key
        return `${agg.getSql()} as ${alias}`
      })
      .join(', ')

    return this.clone<AggregationResult<P>>({
      project: aggregationSql,
    })
  }
}
