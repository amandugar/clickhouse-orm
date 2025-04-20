export function isPrimitive(value: any): boolean {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null ||
    value === undefined
  )
}

export function isDate(value: any): boolean {
  return value instanceof Date
}

export function isArray(value: any): boolean {
  return Array.isArray(value)
}

export function isObject(value: any): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    !isArray(value) &&
    !isDate(value)
  )
}

export function getType(value: any): string {
  if (value === null) return "null"
  if (value === undefined) return "undefined"
  if (isDate(value)) return "date"
  if (isArray(value)) return "array"
  if (isObject(value)) return "object"
  return typeof value
}
