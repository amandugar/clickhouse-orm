import path from "path"
import fs from "fs"
import { Model } from "../models"
import { Schema, SchemaChanges } from "../models/model"
import { Column } from "../@types"
import { memoize } from "lodash"

/**
 * Take two arguments:
 * 1. The path to the model file
 * 2. The path to the output folder
 *
 * If the output folder does not exist, it will be created
 * And it will create a new file for each migration which will have delta from the previous migration
 */

const migrationFiles = memoize((outputPath: string) => {
  const migrationsPath = path.resolve(`${outputPath}/migrations`)
  return fs.readdirSync(migrationsPath)
})

function readMigrations(outputPath: string): SchemaChanges<any, any>[] {
  const migrations = migrationFiles(outputPath)
  return migrations.map(migration => {
    const filePath = path.resolve(`${outputPath}/migrations/${migration}`)
    const diff = require(filePath).diff
    return diff
  })
}

function mergeMigrations(migrations: SchemaChanges<any, any>[]) {
  let mergedMigrations: Schema[] = []
  for (const migration of migrations) {
    if (mergedMigrations.length === 0) {
      for (const change of migration) {
        if (change.changes.type === "CREATE") {
          mergedMigrations.push(change.changes.schema)
        } else {
          throw new Error("Cannot merge migrations with existing models")
        }
      }
    } else {
      for (const change of migration) {
        if (change.changes.type === "CREATE") {
          mergedMigrations.push(change.changes.schema)
        } else if (change.changes.type === "UPDATE") {
          const changeTableName = change.changes.tableName
          const addColumns = change.changes.add ?? []
          const removeColumns = change.changes.remove ?? []
          const updateColumns = change.changes.update ?? []

          const schema = mergedMigrations.find(
            m => m.tableName === changeTableName
          )

          if (!schema) {
            throw new Error("Cannot find schema for table")
          }

          for (const column of addColumns) {
            schema.columns.push(column)
          }

          for (const column of removeColumns) {
            schema.columns = schema.columns.filter(c => c.name !== column)
          }

          for (const column of updateColumns) {
            const columnIndex = schema.columns.findIndex(
              c => c.name === column.name
            )

            if (columnIndex === -1) {
              throw new Error("Cannot find column to update")
            }

            schema.columns[columnIndex] = column
          }
        } else if (change.changes.type === "DROP") {
          const changeTableName = change.changes.schema.tableName
          const schema = mergedMigrations.find(
            m => m.tableName === changeTableName
          )

          if (!schema) {
            throw new Error("Cannot find schema for table")
          }

          mergedMigrations = mergedMigrations.filter(
            m => m.tableName !== changeTableName
          )
        }
      }
    }
  }

  return mergedMigrations
}

function diffSchemas(
  existingSchemas: Schema[],
  newSchemas: Schema[]
): SchemaChanges<any, any> {
  const diff: SchemaChanges<any, any> = []

  for (const newSchema of newSchemas) {
    const existingSchema = existingSchemas.find(
      s => s.tableName === newSchema.tableName
    )

    // if the schema is existing schema but not in the new schemas, it means it has been dropped

    if (!existingSchema) {
      diff.push({
        changes: { type: "CREATE", schema: newSchema },
      })

      continue
    }

    if (existingSchema) {
      const existingColumns = existingSchema.columns.map(c => c.name)
      const newColumns = newSchema.columns.map(c => c.name)

      const addedColumns = newColumns.filter(c => !existingColumns.includes(c))
      const removedColumns = existingColumns.filter(
        c => !newColumns.includes(c)
      )
      const updatedColumns = newColumns.filter(
        c =>
          JSON.stringify(existingColumns[c]) !== JSON.stringify(newColumns[c])
      )

      const addedFullColumns: Column[] = addedColumns.map(
        c => newSchema.columns.find(col => col.name === c) as Column
      )

      const updatedFullColumns: Column[] = updatedColumns.map(
        c => newSchema.columns.find(col => col.name === c) as Column
      )

      if (
        addedColumns.length > 0 ||
        removedColumns.length > 0 ||
        updatedColumns.length > 0
      ) {
        diff.push({
          changes: {
            type: "UPDATE" as const,
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

  const newSchemasTableNames = newSchemas.map(s => s.tableName)
  const existingSchemasTableNames = existingSchemas.map(s => s.tableName)

  const droppedSchemas = existingSchemasTableNames.filter(
    s => !newSchemasTableNames.includes(s)
  )

  for (const schema of droppedSchemas) {
    diff.push({
      changes: {
        type: "DROP",
        schema: {
          tableName: schema,
        },
      },
    })
  }

  return diff
}

async function generateSchema(modelPath: string, outputPath: string) {
  try {
    // Resolve the absolute path
    const absolutePath = path.resolve(process.cwd(), modelPath)

    // Check if file exists
    if (!fs.existsSync(absolutePath)) {
      console.error(`Error: File not found at ${absolutePath}`)
      process.exit(1)
    }

    // Import the models dynamically
    const models = require(absolutePath)

    console.log(`Generating schema from ${modelPath}:`)

    // Get all models from the export
    const modelEntries = Object.entries(models.default || models)

    if (modelEntries.length === 0) {
      console.error("Error: No models found in the specified file")
      process.exit(1)
    }

    const currentSchemas: Schema[] = []

    for (const [modelName, ModelClass] of modelEntries) {
      let model: typeof Model<any, any> = ModelClass as typeof Model<any, any>
      if (typeof model.generateSchema !== "function") {
        console.error(
          `Error: ${modelName} does not have a generateSchema method`
        )
        continue
      }

      const schema = model.generateSchema()
      currentSchemas.push(schema)
    }
    // Write the changes to a file

    // Create the output folder if it doesn't exist
    const migrationsPath = path.resolve(`${outputPath}/migrations`)
    if (!fs.existsSync(migrationsPath)) {
      fs.mkdirSync(migrationsPath, {
        recursive: true,
      })
    }
    const existingMigrations = readMigrations(outputPath)
    const mergedMigrations = mergeMigrations(existingMigrations)
    const diff = diffSchemas(mergedMigrations, currentSchemas)
    const lastFileSorted = migrationFiles(outputPath).sort((a, b) => {
      return a.localeCompare(b)
    })[migrationFiles(outputPath).length - 1]

    if (Object.keys(diff).length === 0) {
      console.log("No changes to the schema")
      process.exit(0)
    }

    const fileString = `
      export const diff = ${JSON.stringify(diff, null, 2)}
      
      export const dependencies = ${
        lastFileSorted ? `['${lastFileSorted}']` : `[]`
      }
    `

    fs.writeFileSync(
      path.resolve(`${migrationsPath}/${Date.now()}-migration.ts`),
      fileString
    )
  } catch (error) {
    console.error("Error generating schema:", error)
    process.exit(1)
  }
}

// Get the model path from command line arguments
const modelPath = process.argv[2]
const outputPath = process.argv[3]
if (!modelPath) {
  console.error("Error: Please provide a path to the model file")
  console.error("Usage: npm run generate-schema -- <path-to-model-file>")
  process.exit(1)
}

const command = process.env.npm_lifecycle_event
if (command === "makemigrations") {
  generateSchema(modelPath, outputPath)
} else if (command === "readmigrations") {
  const migrations = readMigrations(outputPath)
  console.log(JSON.stringify(migrations, null, 2))
}
