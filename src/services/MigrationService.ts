/**
 * @file MigrationService.ts
 * @description This file contains the MigrationService class which manages database migrations
 * for ClickHouse ORM. It handles the generation, tracking, and application of database schema
 * changes over time.
 *
 * The service provides functionality for:
 * - Reading and tracking migration files
 * - Generating new migrations based on model changes
 * - Applying migrations to the database
 * - Managing migration dependencies
 *
 * @example
 * ```typescript
 * const service = new MigrationService('path/to/migrations', credentials);
 * await service.generateSchema('path/to/models.ts');
 * await service.migrate();
 * ```
 *
 * @author ClickHouse ORM Contributors
 * @license MIT
 */

import path from 'path'
import fs from 'fs'
import {
  Model,
  NumberField,
  NumberFieldTypes,
  StringField,
  TableDefinition,
} from '../models'
import { Schema, SchemaChanges } from '../models/model'
import { FieldsOf } from '../models/types/table-definition'
import { MigrationRunner } from './MigrationRunner'
import {
  ConnectionCredentials,
  ConnectionManager,
} from '../utils/database/connection-manager'
import { Engine } from '../utils/engines/engines'
import { SchemaColumn } from './types'

/**
 * Represents a migration record in the database
 */
type Migration = {
  name: string
  timestamp: number
}
/**
 * Creates a memoized version of a function that caches its results
 * @param fn - The function to memoize
 * @returns A memoized version of the function
 */
function memoize<T>(fn: () => T): () => T {
  let cache: T | null = null
  return () => {
    if (cache === null) {
      cache = fn()
    }
    return cache
  }
}

/**
 * Model class for tracking applied migrations in the database
 */
class MigrationTable extends Model<Migration> {
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

/**
 * Service class for managing database migrations
 */
export class MigrationService {
  private readonly migrationsPath: string
  private readonly credentials: ConnectionCredentials

  /**
   * Creates a new instance of MigrationService
   * @param outputPath - Path where migration files will be stored
   * @param credentials - Database connection credentials
   */
  constructor(outputPath: string, credentials: ConnectionCredentials) {
    this.migrationsPath = path.resolve(`${outputPath}/migrations`)
    this.credentials = credentials
  }

  /**
   * Memoized function to get list of migration files
   * @returns Array of migration filenames
   */
  private migrations = memoize((): string[] => {
    return fs.readdirSync(this.migrationsPath)
  })

  /**
   * Reads and parses all migration files
   * @returns Array of schema changes from all migrations
   */
  public readMigrations(): SchemaChanges[] {
    const migrations = this.migrations()
    return migrations.map((migration) => {
      const filePath = path.resolve(`${this.migrationsPath}/${migration}`)
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('ts-node').register()
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const diff = require(filePath).diff
      return diff
    })
  }

  /**
   * Merges multiple migrations into a single schema state
   * @param migrations - Array of schema changes to merge
   * @returns Array of merged schemas
   * @throws Error if migrations cannot be merged (e.g., trying to modify non-existent tables)
   */
  private mergeMigrations(migrations: SchemaChanges[]): Schema[] {
    let mergedMigrations: Schema[] = []
    for (const migration of migrations) {
      if (mergedMigrations.length === 0) {
        for (const change of migration) {
          if (change.changes.type === 'CREATE') {
            mergedMigrations.push(change.changes.schema)
          } else {
            throw new Error('Cannot merge migrations with existing models')
          }
        }
      } else {
        for (const change of migration) {
          if (change.changes.type === 'CREATE') {
            mergedMigrations.push(change.changes.schema)
          } else if (change.changes.type === 'UPDATE') {
            const changeTableName = change.changes.tableName
            const addColumns = change.changes.add ?? []
            const removeColumns = change.changes.remove ?? []
            const updateColumns = change.changes.update ?? []

            const schema = mergedMigrations.find(
              (m) => m.tableName === changeTableName,
            )

            if (!schema) {
              throw new Error('Cannot find schema for table')
            }

            // Apply column additions
            for (const column of addColumns) {
              schema.columns.push(column)
            }

            // Apply column removals
            for (const column of removeColumns) {
              schema.columns = schema.columns.filter((c) => c.name !== column)
            }

            // Apply column updates
            for (const column of updateColumns) {
              const columnIndex = schema.columns.findIndex(
                (c) => c.name === column.name,
              )

              if (columnIndex === -1) {
                throw new Error('Cannot find column to update')
              }

              schema.columns[columnIndex] = column
            }
          } else if (change.changes.type === 'DROP') {
            const changeTableName = change.changes.schema.tableName
            mergedMigrations = mergedMigrations.filter(
              (m) => m.tableName !== changeTableName,
            )
          }
        }
      }
    }

    return mergedMigrations
  }

  /**
   * Compares existing schemas with new schemas to generate migration changes
   * @param existingSchemas - Current database schemas
   * @param newSchemas - New schemas to compare against
   * @returns Array of schema changes needed to update the database
   */
  private diffSchemas(
    existingSchemas: Schema[],
    newSchemas: Schema[],
  ): SchemaChanges {
    const diff: SchemaChanges = []

    // Handle new and modified tables
    for (const newSchema of newSchemas) {
      const existingSchema = existingSchemas.find(
        (s) => s.tableName === newSchema.tableName,
      )

      if (!existingSchema) {
        diff.push({
          changes: { type: 'CREATE', schema: newSchema },
        })
        continue
      }

      if (existingSchema) {
        const existingColumns = existingSchema.columns.map((c) => c.name)
        const newColumns = newSchema.columns.map((c) => c.name)

        // Find added, removed, and updated columns
        const addedColumns = newColumns.filter(
          (c) => !existingColumns.includes(c),
        )
        const removedColumns = existingColumns.filter(
          (c) => !newColumns.includes(c),
        )

        const updatedColumns = newColumns.filter(
          (c) =>
            JSON.stringify(
              existingSchema.columns.find((col) => col.name === c),
            ) !==
            JSON.stringify(newSchema.columns.find((col) => col.name === c)),
        )

        const addedFullColumns: SchemaColumn[] = addedColumns.map(
          (c) =>
            newSchema.columns.find((col) => col.name === c) as SchemaColumn,
        )

        const updatedFullColumns: SchemaColumn[] = updatedColumns.map(
          (c) =>
            newSchema.columns.find((col) => col.name === c) as SchemaColumn,
        )

        if (
          addedColumns.length > 0 ||
          removedColumns.length > 0 ||
          updatedColumns.length > 0
        ) {
          diff.push({
            changes: {
              type: 'UPDATE' as const,
              tableName: newSchema.tableName,
              ...(addedColumns.length > 0 ? { add: addedFullColumns } : {}),
              ...(removedColumns.length > 0 ? { remove: removedColumns } : {}),
              ...(updatedColumns.length > 0
                ? { update: updatedFullColumns }
                : {}),
            },
          })
        }
      }
    }

    // Handle dropped tables
    const newSchemasTableNames = newSchemas.map((s) => s.tableName)
    const existingSchemasTableNames = existingSchemas.map((s) => s.tableName)

    const droppedSchemas = existingSchemasTableNames.filter(
      (s) => !newSchemasTableNames.includes(s),
    )

    for (const schema of droppedSchemas) {
      diff.push({
        changes: {
          type: 'DROP',
          schema: {
            tableName: schema,
          },
        },
      })
    }

    return diff
  }

  /**
   * Generates a new migration file based on model changes
   * @param modelPath - Path to the models file
   * @throws Error if the file doesn't exist or contains no models
   */
  public async generateSchema(modelPath: string): Promise<void> {
    try {
      // Resolve the absolute path
      const absolutePath = path.resolve(process.cwd(), modelPath)

      // Check if file exists
      if (!fs.existsSync(absolutePath)) {
        throw new Error(`File not found at ${absolutePath}`)
      }

      // Import the models dynamically
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('ts-node').register()
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const models = require(absolutePath)

      console.log(`Generating schema from ${modelPath}:`)

      // Get all models from the export
      const modelEntries = Object.entries(models.default || models)

      if (modelEntries.length === 0) {
        throw new Error('No models found in the specified file')
      }

      const currentSchemas: Schema[] = []

      // Generate schemas for each model
      for (const [modelName, ModelClass] of modelEntries) {
        const model: typeof Model = ModelClass as typeof Model
        if (typeof model.generateSchema !== 'function') {
          console.error(
            `Error: ${modelName} does not have a generateSchema method`,
          )
          continue
        }

        const schema = model.generateSchema()
        currentSchemas.push(schema)
      }

      // Create the output folder if it doesn't exist
      if (!fs.existsSync(this.migrationsPath)) {
        fs.mkdirSync(this.migrationsPath, {
          recursive: true,
        })
      }

      // Generate and write the migration file
      const existingMigrations = this.readMigrations()
      const mergedMigrations = this.mergeMigrations(existingMigrations)
      const diff = this.diffSchemas(mergedMigrations, currentSchemas)
      const lastFileSorted = this.migrations().sort((a, b) => {
        return a.localeCompare(b)
      })[this.migrations().length - 1]

      if (Object.keys(diff).length === 0) {
        console.log('No changes to the schema')
        return
      }

      const fileString = `
        export const diff = ${JSON.stringify(diff, null, 2)}
        
        export const dependencies = ${lastFileSorted ? `['${lastFileSorted}']` : `[]`}
      `

      fs.writeFileSync(
        path.resolve(`${this.migrationsPath}/${Date.now()}-migration.ts`),
        fileString,
      )
    } catch (error) {
      console.error('Error generating schema:', error)
      throw error
    }
  }

  /**
   * Applies all pending migrations to the database
   * Creates the migrations table if it doesn't exist
   * Records applied migrations in the database
   */
  public async migrate(): Promise<void> {
    // Create migrations table if it doesn't exist
    const schema = MigrationTable.generateSchema()
    const runner = new MigrationRunner(this.credentials)
    await runner.createTable(schema)
    ConnectionManager.setDefault({
      credentials: this.credentials,
    })

    // Get list of applied migrations
    const allMigrations = await new MigrationTable().objects.all()
    const migrationsToApply = this.migrations().filter(
      (migration) => !allMigrations.some((m) => m.name === migration),
    )

    // Apply each pending migration
    for (const migration of migrationsToApply) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const diff = require(path.resolve(`${this.migrationsPath}/${migration}`))
        .diff as SchemaChanges

      // Apply each change in the migration
      for (const change of diff) {
        if (change.changes.type === 'CREATE') {
          await runner.createTable(change.changes.schema)
        } else if (change.changes.type === 'UPDATE') {
          const { tableName, add, remove, update } = change.changes

          if (add && add.length > 0) {
            await runner.addColumns(tableName, add)
          }

          if (remove && remove.length > 0) {
            await runner.dropColumns(tableName, remove)
          }

          if (update && update.length > 0) {
            await runner.updateColumns(tableName, update)
          }
        } else if (change.changes.type === 'DROP') {
          await runner.dropTable(change.changes.schema.tableName)
        }
      }

      // Record the migration as applied
      const migrationTable = new MigrationTable({
        credentials: this.credentials,
      })
      const migrationFile = migrationTable.create({
        name: migration,
        timestamp: Date.now(),
      })
      await migrationFile.save()
    }
  }
}
