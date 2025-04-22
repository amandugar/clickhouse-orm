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
<<<<<<< HEAD
export * from './models'
export * from './services'
export * from './utils'
// Export main classes and types
export { Model, ConnectionManager, ConnectionCredentials, ConnectionConfig }
=======
export * from './models/fields/base-field'
export * from './models/types/table-definition'
export * from './models/fields/boolean-field'
export * from './models/fields/number-field'
export * from './models/fields/string-field'
export * from './models/fields/array-field'
export * from './models/fields/tuple-field'
export * from './services/types'

// Export main classes and types
export {
  Model,
  ConnectionManager,
  ConnectionCredentials,
  ConnectionConfig,
  MigrationService,
  MigrationRunner,
}
>>>>>>> c35c6461abe8813529bd14b99b6c4926efd428d0

export const Types = {
  Number: NumberTypes,
  String: StringTypes,
  Boolean: BooleanTypes,
} as const
