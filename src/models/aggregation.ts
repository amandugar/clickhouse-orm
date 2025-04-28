/**
 * Aggregation operators for ClickHouse ORM
 * Similar to Django's aggregation functions
 */

/**
 * Base class for all aggregation operators
 */
export abstract class AggregationOperator {
  protected field: string | AggregationOperator
  public alias?: string
  public readonly returnType: unknown

  constructor(field: string | AggregationOperator, alias?: string) {
    this.field = field
    this.alias = alias
  }

  protected getFieldSql(): string {
    if (this.field instanceof AggregationOperator) {
      return this.field.getSql()
    }
    return String(this.field)
  }

  abstract getSql(): string
}

/**
 * Sum aggregation operator
 * @example
 * ```typescript
 * new Sum('price', 'total_revenue')
 * // SUM(price) as total_revenue
 * ```
 */
export class Sum extends AggregationOperator {
  public readonly returnType: number = 0

  getSql(): string {
    return `SUM(${this.getFieldSql()})`
  }
}

/**
 * Average aggregation operator
 * @example
 * ```typescript
 * new Avg('price', 'avg_price')
 * // AVG(price) as avg_price
 * ```
 */
export class Avg extends AggregationOperator {
  public readonly returnType: number = 0

  getSql(): string {
    return `AVG(${this.getFieldSql()})`
  }
}

/**
 * Count aggregation operator
 * @example
 * ```typescript
 * new Count('*', 'total_count')
 * // COUNT(*) as total_count
 * ```
 */
export class Count extends AggregationOperator {
  public readonly returnType: number = 0

  getSql(): string {
    return `COUNT(${this.getFieldSql()})`
  }
}

/**
 * Minimum aggregation operator
 * @example
 * ```typescript
 * new Min('price', 'min_price')
 * ```
 */
export class Min extends AggregationOperator {
  public readonly returnType: number = 0

  getSql(): string {
    return `MIN(${this.getFieldSql()})`
  }
}

/**
 * Maximum aggregation operator
 * @example
 * ```typescript
 * new Max('price', 'max_price')
 * // MAX(price) as max_price
 * ```
 */
export class Max extends AggregationOperator {
  public readonly returnType: number = 0

  getSql(): string {
    return `MAX(${this.getFieldSql()})`
  }
}

/**
 * Type for aggregation results
 * Maps aggregation aliases to their result types
 */
export type AggregationResult<T extends Record<string, AggregationOperator>> = {
  [K in keyof T]: T[K] extends AggregationOperator ? T[K]['returnType'] : never
}

export class ArithmeticOperator extends AggregationOperator {
  public readonly returnType: number = 0

  constructor(
    protected left: AggregationOperator,
    protected operator: '+' | '-' | '*' | '/',
    protected right: AggregationOperator,
    alias?: string,
  ) {
    super(left, alias)
  }

  getSql(): string {
    const sql = `(${this.left.getSql()} ${this.operator} ${this.right.getSql()})`
    return this.alias ? `${sql} as ${this.alias}` : sql
  }
}

// Helper functions for arithmetic operations
export function add(
  left: AggregationOperator,
  right: AggregationOperator,
): ArithmeticOperator {
  return new ArithmeticOperator(left, '+', right)
}

export function subtract(
  left: AggregationOperator,
  right: AggregationOperator,
): ArithmeticOperator {
  return new ArithmeticOperator(left, '-', right)
}

export function multiply(
  left: AggregationOperator,
  right: AggregationOperator,
): ArithmeticOperator {
  return new ArithmeticOperator(left, '*', right)
}

export function divide(
  left: AggregationOperator,
  right: AggregationOperator,
): ArithmeticOperator {
  return new ArithmeticOperator(left, '/', right)
}
