/**
 * Query Builder Operators Documentation
 *
 * This file documents all available operators in the query builder.
 * Operators can be used with field names by appending the operator suffix.
 *
 * Example: `{ field__operator: value }`
 */

/**
 * Comparison Operators
 *
 * These operators are used for comparing field values.
 */
export const ComparisonOperators = {
  /**
   * Greater than
   * @example
   * ```typescript
   * { age__gt: 18 } // age > 18
   * ```
   */
  GT: '__gt',

  /**
   * Less than
   * @example
   * ```typescript
   * { age__lt: 65 } // age < 65
   * ```
   */
  LT: '__lt',

  /**
   * Greater than or equal
   * @example
   * ```typescript
   * { age__gte: 18 } // age >= 18
   * ```
   */
  GTE: '__gte',

  /**
   * Less than or equal
   * @example
   * ```typescript
   * { age__lte: 65 } // age <= 65
   * ```
   */
  LTE: '__lte',

  /**
   * Not equal
   * @example
   * ```typescript
   * { status__ne: 'inactive' } // status != 'inactive'
   * ```
   */
  NE: '__ne',
} as const

/**
 * String Operators
 *
 * These operators are used for string pattern matching.
 */
export const StringOperators = {
  /**
   * Case-insensitive contains
   * @example
   * ```typescript
   * { name__icontains: 'john' } // name LIKE '%john%'
   * ```
   */
  ICONTAINS: '__icontains',
} as const

/**
 * Set Operators
 *
 * These operators are used for checking if a value is in a set.
 */
export const SetOperators = {
  /**
   * In set
   * @example
   * ```typescript
   * { status__in: ['active', 'pending'] } // status IN ('active', 'pending')
   * ```
   */
  IN: '__in',
} as const

/**
 * Logical Operators
 *
 * These operators are used for combining conditions.
 */
export const LogicalOperators = {
  /**
   * AND operator
   * @example
   * ```typescript
   * new Q().and([{ age__gt: 18 }, { status: 'active' }])
   * // (age > 18 AND status = 'active')
   * ```
   */
  AND: 'AND',

  /**
   * OR operator
   * @example
   * ```typescript
   * new Q().or([{ status: 'active' }, { status: 'pending' }])
   * // (status = 'active' OR status = 'pending')
   * ```
   */
  OR: 'OR',

  /**
   * NOT operator
   * @example
   * ```typescript
   * new Q().not({ status: 'inactive' })
   * // NOT (status = 'inactive')
   * ```
   */
  NOT: 'NOT',
} as const

/**
 * All available operator suffixes
 */
export type OperatorSuffix =
  | (typeof ComparisonOperators)[keyof typeof ComparisonOperators]
  | (typeof StringOperators)[keyof typeof StringOperators]
  | (typeof SetOperators)[keyof typeof SetOperators]

/**
 * All available logical operators
 */
export type LogicalOperator =
  (typeof LogicalOperators)[keyof typeof LogicalOperators]

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
