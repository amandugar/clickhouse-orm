// Connection types
export interface ConnectionCredentials {
  host: string
  port: number
  user: string
  password: string
  database: string
}

export interface ConnectionConfig {
  credentials: ConnectionCredentials
  options?: {
    debug?: boolean
    ssl?: boolean
  }
}

// Model types
export interface TableDefinition {
  name: string
  engine: string
  columns: Record<string, any>
  primaryKey?: string[]
  orderBy?: string[]
  partitionBy?: string[]
  settings?: Record<string, any>
}

// Field types
export interface FieldOptions {
  nullable?: boolean
  default?: any
  alias?: string
  materialized?: boolean
  codec?: string
  ttl?: string
}

// Migration types
export interface Migration {
  up: () => Promise<void>
  down: () => Promise<void>
}

export interface MigrationConfig {
  tableName?: string
  directory?: string
}

// Query types
export interface QueryOptions {
  limit?: number
  offset?: number
  orderBy?: string | string[]
  groupBy?: string | string[]
  having?: string
  distinct?: boolean
}

// Export all types
export * from "../models/fields/base-field"
export * from "../models/definitions/table-definition"
export * from "../models/model"
