import { FieldOptions } from "../types"

export function validateFieldOptions(options: FieldOptions): void {
  if (options.nullable !== undefined && typeof options.nullable !== "boolean") {
    throw new Error("nullable must be a boolean")
  }

  if (options.alias !== undefined && typeof options.alias !== "string") {
    throw new Error("alias must be a string")
  }

  if (
    options.materialized !== undefined &&
    typeof options.materialized !== "boolean"
  ) {
    throw new Error("materialized must be a boolean")
  }

  if (options.codec !== undefined && typeof options.codec !== "string") {
    throw new Error("codec must be a string")
  }

  if (options.ttl !== undefined && typeof options.ttl !== "string") {
    throw new Error("ttl must be a string")
  }
}

export function validateTableName(name: string): void {
  if (!name || typeof name !== "string") {
    throw new Error("Table name must be a non-empty string")
  }

  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(
      "Table name must start with a letter or underscore and contain only letters, numbers, and underscores"
    )
  }
}

export function validateColumnName(name: string): void {
  if (!name || typeof name !== "string") {
    throw new Error("Column name must be a non-empty string")
  }

  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(
      "Column name must start with a letter or underscore and contain only letters, numbers, and underscores"
    )
  }
}
