import { QueryOptions } from "../types"

export function buildQueryOptions(options: QueryOptions): string {
  const parts: string[] = []

  if (options.limit) {
    parts.push(`LIMIT ${options.limit}`)
  }

  if (options.offset) {
    parts.push(`OFFSET ${options.offset}`)
  }

  if (options.orderBy) {
    const orderBy = Array.isArray(options.orderBy)
      ? options.orderBy.join(", ")
      : options.orderBy
    parts.push(`ORDER BY ${orderBy}`)
  }

  if (options.groupBy) {
    const groupBy = Array.isArray(options.groupBy)
      ? options.groupBy.join(", ")
      : options.groupBy
    parts.push(`GROUP BY ${groupBy}`)
  }

  if (options.having) {
    parts.push(`HAVING ${options.having}`)
  }

  if (options.distinct) {
    parts.unshift("DISTINCT")
  }

  return parts.join(" ")
}

export function escapeValue(value: any): string {
  if (value === null || value === undefined) {
    return "NULL"
  }

  if (typeof value === "string") {
    return `'${value.replace(/'/g, "''")}'`
  }

  if (typeof value === "boolean") {
    return value ? "1" : "0"
  }

  if (value instanceof Date) {
    return `'${value.toISOString()}'`
  }

  if (Array.isArray(value)) {
    return `[${value.map(escapeValue).join(", ")}]`
  }

  return String(value)
}
