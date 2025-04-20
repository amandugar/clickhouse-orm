import path from 'path'
import fs from 'fs'
import { Model, NumberField, StringField, TableDefinition } from '../models'
import { Schema, SchemaChanges } from '../models/model'
import { Column } from '../@types'
import { memoize } from 'lodash'
import { FieldsOf } from '../models/definitions/table-definition'
import { MigrationRunner } from './MigrationRunner'
import {
  ConnectionCredentials,
  ConnectionManager,
} from '../utils/connection-manager'

type Migration = {
  name: string
  timestamp: number
}

class MigrationTable extends Model<Migration> {
  static tableDefinition: TableDefinition<Migration> = {
    tableName: 'migrations',
    engine: 'MergeTree',
    orderBy: ['name'],
  }

  protected static fields: FieldsOf<Migration> = {
    name: new StringField({}),
    timestamp: new NumberField({}),
  }
}

export class MigrationService {
  private readonly migrationsPath: string
  private readonly credentials: ConnectionCredentials

  constructor(outputPath: string, credentials: ConnectionCredentials) {
    this.migrationsPath = path.resolve(`${outputPath}/migrations`)
    this.credentials = credentials
  }

  private migrations = memoize((): string[] => {
    return fs.readdirSync(this.migrationsPath)
  })

  public readMigrations(): SchemaChanges[] {
    const migrations = this.migrations()
    return migrations.map((migration) => {
      const filePath = path.resolve(`${this.migrationsPath}/${migration}`)
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const diff = require(filePath).diff
      return diff
    })
  }

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

            for (const column of addColumns) {
              schema.columns.push(column)
            }

            for (const column of removeColumns) {
              schema.columns = schema.columns.filter((c) => c.name !== column)
            }

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

  private diffSchemas(
    existingSchemas: Schema[],
    newSchemas: Schema[],
  ): SchemaChanges {
    const diff: SchemaChanges = []

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

        const addedFullColumns: Column[] = addedColumns.map(
          (c) => newSchema.columns.find((col) => col.name === c) as Column,
        )

        const updatedFullColumns: Column[] = updatedColumns.map(
          (c) => newSchema.columns.find((col) => col.name === c) as Column,
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

  public async generateSchema(modelPath: string): Promise<void> {
    try {
      // Resolve the absolute path
      const absolutePath = path.resolve(process.cwd(), modelPath)

      // Check if file exists
      if (!fs.existsSync(absolutePath)) {
        throw new Error(`File not found at ${absolutePath}`)
      }

      // Import the models dynamically
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const models = require(absolutePath)

      console.log(`Generating schema from ${modelPath}:`)

      // Get all models from the export
      const modelEntries = Object.entries(models.default || models)

      if (modelEntries.length === 0) {
        throw new Error('No models found in the specified file')
      }

      const currentSchemas: Schema[] = []

      for (const [modelName, ModelClass] of modelEntries) {
        const model: typeof Model<any, any> = ModelClass as typeof Model<
          any,
          any
        >
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

  public async migrate(): Promise<void> {
    const schema = MigrationTable.generateSchema()
    const runner = new MigrationRunner(this.credentials)
    await runner.createTable(schema)
    ConnectionManager.setDefault({
      credentials: this.credentials,
    })
    const allMigrations = await new MigrationTable().objects.all()
    const migrationsToApply = this.migrations().filter(
      (migration) => !allMigrations.some((m) => m.name === migration),
    )

    for (const migration of migrationsToApply) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const diff = require(path.resolve(`${this.migrationsPath}/${migration}`))
        .diff as SchemaChanges

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
