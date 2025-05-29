/**
 * @file MigrationTable.ts
 * @description This file contains the MigrationTable model for tracking applied migrations
 * in the database.
 *
 * @author ClickHouse ORM Contributors
 * @license MIT
 */

import { Model } from './index'
import { StringField, NumberField, NumberFieldTypes } from './index'
import { FieldsOf } from './types/table-definition'
import { TableDefinition } from './index'
import { Engine } from '../utils/engines/engines'

/**
 * Represents a migration record in the database
 */
export type Migration = {
  name: string
  timestamp: number
}

/**
 * Model class for tracking applied migrations in the database
 */
export class MigrationTable extends Model<Migration> {
  static tableDefinition: TableDefinition<Migration> = {
    tableName: 'migrations',
    engine: Engine.MERGE_TREE,
    orderBy: ['name'],
  }

  protected static fields: FieldsOf<Migration> = {
    name: new StringField({}),
    timestamp: new NumberField({
      type: NumberFieldTypes.Int64,
    }),
  }
}
