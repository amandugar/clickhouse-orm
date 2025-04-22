import { Model } from './models/model'
import {
  ConnectionManager,
  ConnectionCredentials,
  ConnectionConfig,
} from './utils/database/connection-manager'
import { NumberTypes } from './models/fields/number-field'
import { StringTypes } from './models/fields/string-field'
import { BooleanTypes } from './models/fields/boolean-field'

// Export all types first
export * from './models'
export * from './services'
export * from './utils'
// Export main classes and types
export { Model, ConnectionManager, ConnectionCredentials, ConnectionConfig }

export const Types = {
  Number: NumberTypes,
  String: StringTypes,
  Boolean: BooleanTypes,
} as const
