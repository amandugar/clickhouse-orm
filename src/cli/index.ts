#!/usr/bin/env node

import path from 'path'
import { MigrationService } from '../services/MigrationService'
import {
  ConnectionCredentials,
  ConnectionManager,
} from '../utils/database/connection-manager'
import { Command } from 'commander'

const program = new Command()

program
  .name('thunder-schema')
  .description('A TypeScript ORM for ClickHouse with migrations support')
  .version('1.0.9')

program
  .command('makemigrations')
  .description('Generate migration files')
  .argument('<model-path>', 'Path to the model file')
  .argument('[output-path]', 'Path to output migrations')
  .action(async (modelPath: string, outputPath?: string) => {
    if (!outputPath) {
      outputPath = path.join(process.cwd(), 'migrations')
    }
    if (!modelPath) {
      modelPath = path.join(process.cwd(), 'models')
    }
    const credentials = getCredentials()
    const migrationService = new MigrationService(outputPath, credentials)
    await migrationService.generateSchema(modelPath)
  })

program
  .command('readmigrations')
  .description('List all migrations')
  .argument('[migrations-path]', 'Path to migrations')
  .action((migrationsPath?: string) => {
    if (!migrationsPath) {
      migrationsPath = path.join(process.cwd(), 'migrations')
    }
    const credentials = getCredentials()
    const migrationService = new MigrationService(migrationsPath, credentials)
    const migrations = migrationService.readMigrations()
    console.log(migrations)
  })

program
  .command('migrate')
  .description('Apply pending migrations')
  .argument('[migrations-path]', 'Path to migrations')
  .action(async (migrationsPath?: string) => {
    if (!migrationsPath) {
      migrationsPath = path.join(process.cwd(), 'migrations')
    }
    const credentials = getCredentials()
    const migrationService = new MigrationService(migrationsPath, credentials)
    await migrationService.migrate()
  })

function getCredentials(): ConnectionCredentials {
  return {
    url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USERNAME || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
    database: process.env.CLICKHOUSE_DATABASE || 'default',
  }
}

async function main() {
  try {
    const credentials = getCredentials()
    ConnectionManager.setDefault({
      credentials: { ...credentials, database: 'default' },
    })

    await program.parseAsync(process.argv)
    console.log('Operation completed successfully')
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

void main()
