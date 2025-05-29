/**
 * @file JsonMigrationService.ts
 * @description This file contains the JsonMigrationService class which handles database migrations
 * from JSON input for ClickHouse ORM.
 *
 * @example
 * ```typescript
 * const service = new JsonMigrationService(credentials);
 * await service.migrate(jsonMigrations, 'migration-001');
 * ```
 *
 * @author ClickHouse ORM Contributors
 * @license MIT
 */

import { SchemaChanges } from '../models/model'
import { MigrationRunner } from './MigrationRunner'
import {
  ConnectionCredentials,
  ConnectionManager,
} from '../utils/database/connection-manager'
import { MigrationTable } from '../models/MigrationTable'

/**
 * Service class for managing database migrations from JSON input
 */
export class JsonMigrationService {
  private readonly credentials: ConnectionCredentials

  /**
   * Creates a new instance of JsonMigrationService
   * @param credentials - Database connection credentials
   */
  constructor(credentials: ConnectionCredentials) {
    this.credentials = credentials
  }

  /**
   * Applies migrations directly from JSON input without requiring migration files
   * @param jsonMigrations - Array of schema changes in JSON format
   * @param filename - Name of the migration file (used for tracking)
   * @throws Error if the migrations cannot be applied or if the migration has already been executed
   */
  public async migrate(
    filename: string,
    jsonMigrations: SchemaChanges,
  ): Promise<void> {
    // Create migrations table if it doesn't exist
    const schema = MigrationTable.generateSchema()
    const runner = new MigrationRunner(this.credentials)
    await runner.createTable(schema)
    ConnectionManager.setDefault({
      credentials: this.credentials,
    })

    // Check if migration has already been executed
    const migrationTable = new MigrationTable({
      credentials: this.credentials,
    })
    const existingMigration = await migrationTable.objects
      .filter({
        name: filename,
      })
      .first()

    if (existingMigration) {
      console.log(
        `Migration ${filename} has already been executed. Skipping...`,
      )
      return
    }

    // Apply each change in the migration
    for (const change of jsonMigrations) {
      if (change.changes.type === 'CREATE') {
        console.log('Creating table', change.changes.schema.tableName)
        await runner.createTable(change.changes.schema)
      } else if (change.changes.type === 'UPDATE') {
        const { tableName, add, remove, update } = change.changes
        console.log('Updating table', tableName)

        await runner.updateColumns(
          tableName,
          add ?? [],
          remove ?? [],
          update ?? [],
        )
      } else if (change.changes.type === 'DROP') {
        console.log('Dropping table', change.changes.schema.tableName)
        await runner.dropTable(change.changes.schema.tableName)
      }
    }

    // Record the migration as applied
    const migrationRecord = migrationTable.create({
      name: filename,
      timestamp: Date.now(),
    })
    await migrationRecord.save()
  }
}
