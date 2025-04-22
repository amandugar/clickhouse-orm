/**
 * Query Builder Operators Documentation
 *
 * This file documents all available operators in the query builder.
 * Operators can be used with field names by appending the operator suffix.
 *
 * Example: `{ field__operator: value }`
 */

/**
 * Base SQL Operators
 * These are the actual SQL operators used in queries
 */
export enum SqlOperators {
  EQ = '=',
  NE = '!=',
  GT = '>',
  LT = '<',
  GTE = '>=',
  LTE = '<=',
  LIKE = 'LIKE',
  IN = 'IN',
  IS = 'IS',
  NULL = 'NULL',
  HAS_ANY = 'HAS ANY',
}

/**
 * Field Suffix Operators
 * These are the suffixes used in field names to specify operators
 */
export enum FieldOperators {
  /**
   * Equal to
   * @example
   * ```typescript
   * { age: 18 } // age = 18
   * ```
   */
  EQ = '',

  /**
   * Greater than
   * @example
   * ```typescript
   * { age__gt: 18 } // age > 18
   * ```
   */
  GT = '__gt',

  /**
   * Less than
   * @example
   * ```typescript
   * { age__lt: 65 } // age < 65
   * ```
   */
  LT = '__lt',

  /**
   * Greater than or equal
   * @example
   * ```typescript
   * { age__gte: 18 } // age >= 18
   * ```
   */
  GTE = '__gte',

  /**
   * Less than or equal
   * @example
   * ```typescript
   * { age__lte: 65 } // age <= 65
   * ```
   */
  LTE = '__lte',

  /**
   * Not equal
   * @example
   * ```typescript
   * { status__ne: 'inactive' } // status != 'inactive'
   * ```
   */
  NE = '__ne',

  /**
   * Case-insensitive contains
   * @example
   * ```typescript
   * { name__icontains: 'john' } // name LIKE '%john%'
   * ```
   */
  ICONTAINS = '__icontains',

  /**
   * In set
   * @example
   * ```typescript
   * { status__in: ['active', 'pending'] } // status IN ('active', 'pending')
   * ```
   */
  IN = '__in',

  /**
   * Has any of the values
   * @example
   * ```typescript
   * { tags__has_any: ['python', 'typescript'] } // tags HAS ANY ('python', 'typescript')
   * ```
   */
  HAS_ANY = '__has_any',
}

/**
 * Logical Operators
 *
 * These operators are used for combining conditions.
 */
export enum LogicalOperators {
  /**
   * AND operator
   * @example
   * ```typescript
   * new Q().and([{ age__gt: 18 }, { status: 'active' }])
   * // (age > 18 AND status = 'active')
   * ```
   */
  AND = 'AND',

  /**
   * OR operator
   * @example
   * ```typescript
   * new Q().or([{ status: 'active' }, { status: 'pending' }])
   * // (status = 'active' OR status = 'pending')
   * ```
   */
  OR = 'OR',

  /**
   * NOT operator
   * @example
   * ```typescript
   * new Q().not({ status: 'inactive' })
   * // NOT (status = 'inactive')
   * ```
   */
  NOT = 'NOT',
}

/**
 * Type-safe mapping from field operators to SQL operators
 */
export const FIELD_TO_SQL_OPERATOR: Record<FieldOperators, SqlOperators> = {
  [FieldOperators.EQ]: SqlOperators.EQ,
  [FieldOperators.GT]: SqlOperators.GT,
  [FieldOperators.LT]: SqlOperators.LT,
  [FieldOperators.GTE]: SqlOperators.GTE,
  [FieldOperators.LTE]: SqlOperators.LTE,
  [FieldOperators.NE]: SqlOperators.NE,
  [FieldOperators.ICONTAINS]: SqlOperators.LIKE,
  [FieldOperators.IN]: SqlOperators.IN,
  [FieldOperators.HAS_ANY]: SqlOperators.HAS_ANY,
} as const

/**
 * All available operator suffixes
 */
export type OperatorSuffix = FieldOperators

/**
 * All available logical operators
 */
export type LogicalOperator = LogicalOperators

/**
 * Examples of complex queries using operators:
 *
 * ```typescript
 * // Simple comparison
 * { age__gt: 18 }
 *
 * // String contains
 * { name__icontains: 'john' }
 *
 * // In set
 * { status__in: ['active', 'pending'] }
 *
 * // Complex AND condition
 * new Q().and([
 *   { age__gt: 18 },
 *   { status: 'active' },
 *   { name__icontains: 'john' }
 * ])
 *
 * // Complex OR condition
 * new Q().or([
 *   { status: 'active' },
 *   { status: 'pending' },
 *   { age__lt: 18 }
 * ])
 *
 * // NOT condition
 * new Q().not({ status: 'inactive' })
 *
 * // Nested conditions
 * new Q().and([
 *   { age__gt: 18 },
 *   new Q().or([
 *     { status: 'active' },
 *     { status: 'pending' }
 *   ])
 * ])
 * ```
 */
