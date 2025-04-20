import { MigrationService } from '../services/MigrationService'
import {
  ConnectionCredentials,
  ConnectionManager,
} from '../utils/connection-manager'

// Get the model path from command line arguments
const modelPath = process.argv[2]
const outputPath = process.argv[3]

if (!modelPath) {
  console.error('Error: Please provide a path to the model file')
  console.error('Usage: npm run generate-schema -- <path-to-model-file>')
  process.exit(1)
}

const command = process.env.npm_lifecycle_event
const credentials: ConnectionCredentials = {
  url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
  username: process.env.CLICKHOUSE_USERNAME || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || '',
  database: process.env.CLICKHOUSE_DATABASE || 'default',
}

ConnectionManager.setDefault({
  credentials: { ...credentials, database: 'default' },
})

const migrationService = new MigrationService(outputPath, credentials)

async function main() {
  if (command === 'makemigrations') {
    migrationService.generateSchema(modelPath).catch((error) => {
      console.error(error)
      process.exit(1)
    })
  } else if (command === 'readmigrations') {
    const migrations = migrationService.readMigrations()
    console.log(migrations)
  } else if (command === 'migrate') {
    await migrationService.migrate()
  }
}

void main()
  .then(() => {
    console.log('Migration completed')
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
