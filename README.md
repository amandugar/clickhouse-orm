# Thunder Schema

A TypeScript ORM (Object-Relational Mapping) library for ClickHouse, providing a simple and type-safe way to interact with ClickHouse databases.

## Features

- Type-safe model definitions
- Query builder for complex queries
- Migration support
- Connection management
- Support for various ClickHouse table engines
- TypeScript-first approach

## Installation

```bash
npm install thunder-schema
# or
yarn add thunder-schema
```

## Quick Start

### 1. Define Your Models

```typescript
import { Model, NumberField, StringField } from 'thunder-schema'
import { FieldsOf, TableDefinition } from 'thunder-schema'

type UserSchema = {
  id: number
  name: string
  email: string
  createdAt: number
  updatedAt: number
  deletedAt: number
}

class User extends Model<UserSchema> {
  static fields: FieldsOf<UserSchema> = {
    id: new NumberField({}),
    name: new StringField({}),
    email: new StringField({}),
    createdAt: new NumberField({}),
    updatedAt: new NumberField({}),
    deletedAt: new NumberField({}),
  }

  static tableDefinition: TableDefinition<UserSchema> = {
    tableName: 'users',
    engine: 'MergeTree',
    orderBy: ['createdAt'],
  }
}
```

### 2. Configure Database Connection

```typescript
import { ConnectionManager, ConnectionConfig } from 'thunder-schema'

const config: ConnectionConfig = {
  host: 'localhost',
  port: 9000,
  user: 'default',
  password: '',
  database: 'default'
}

const connectionManager = new ConnectionManager(config)
```

### 3. Using the Model

```typescript
// Create a new user
const user = await User.create({
  name: 'John Doe',
  email: 'john@example.com',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  deletedAt: 0
})

// Find users
const users = await User.find({ name: 'John Doe' })

// Update a user
await user.update({ name: 'Jane Doe' })

// Delete a user
await user.delete()
```

## Advanced Usage

### Query Builder

```typescript
import { QueryBuilder } from 'thunder-schema'

const query = userModel.objects.filter(
  new Q<User>().or([
    { id: 1 },
    { id: 2 }
  ])
)

const results = await query.all()
```

### Nested Queries and Complex Conditions

The ORM supports complex nested queries using the `Q` class for building sophisticated conditions:

```typescript
import { Q } from 'thunder-schema'

// Simple OR conditions
const query = userModel.objects.filter(
  new Q<User>().or([
    { id: 1 },
    { id: 2 }
  ])
)

// Complex nested conditions
const complexQuery = userModel.objects.filter(
  new Q<User>().or([
    new Q<User>().and([{ id: 1 }, { name: 'John' }]),
    new Q<User>().not(
      new Q<User>().or([{ id: 2 }, { email: 'test@test.com' }])
    )
  ])
)

// The above generates SQL like:
// SELECT * FROM users WHERE ((id = 1 AND name = 'John') OR (NOT (id = 2 OR email = 'test@test.com')))
```

### Async Iteration and Streaming

The ORM supports async iteration for efficient data streaming:

```typescript
// Using async iteration
const query = userModel.objects.filter({ isActive: true })
for await (const user of query) {
  console.log(user)
}

// Converting to array
const allUsers = await userModel.objects.all()

// Combining with nested queries
const complexQuery = userModel.objects.filter(
  new Q<User>().or([
    { id: 1 },
    { id: 2 },
    new Q<User>().and([{ id: 3 }, { email: 'test@test.com' }])
  ])
)

for await (const user of complexQuery) {
  console.log(user)
}
```

### Using .all() Method

The `.all()` method is a convenient way to fetch all results of a query as an array:

```typescript
// Basic usage
const allUsers = await userModel.objects.all()

// With filters
const activeUsers = await userModel.objects
  .filter({ isActive: true })
  .all()

// With complex queries
const specificUsers = await userModel.objects
  .filter(
    new Q<User>().or([
      { id: 1 },
      { id: 2 }
    ])
  )
  .all()

// With pagination
const paginatedUsers = await userModel.objects
  .offset(10)
  .limit(20)
  .all()
```

### In-Place Updates

You can update model instances in-place before saving them to the database:

```typescript
// Create a new user
const user = new User().create({
  name: 'John Doe',
  email: 'john@example.com',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  deletedAt: 0
})

// Update values in-place
user.values.name = 'Jane Doe'
user.values.email = 'jane@example.com'
user.values.updatedAt = Date.now()

// Save the updated values
await user.save()

// You can also update multiple fields at once
Object.assign(user.values, {
  name: 'Jane Smith',
  email: 'jane.smith@example.com',
  updatedAt: Date.now()
})

await user.save()
```

### Materialized Fields

Materialized fields are computed columns that are stored in the table and automatically updated when their source columns change. They are defined using expressions:

```typescript
type UserMaterialized = {
  userName: string
}

class User extends Model<User, UserMaterialized> {
  static fields: FieldsOf<User & UserMaterialized> = {
    id: new NumberField({ type: NumberFieldTypes.Int32 }),
    name: new StringField({ type: StringFieldTypes.String }),
    email: new StringField({ type: StringFieldTypes.String }),
    // Materialized field that concatenates name and email
    userName: new StringField({
      type: StringFieldTypes.String,
      expression: "concat(name, ' ', email)"
    })
  }

  static tableDefinition: TableDefinition<User> = {
    tableName: 'users',
    engine: 'MergeTree',
    orderBy: ['id']
  }
}

// When you create a user, the userName field is automatically computed
const user = new User().create({
  name: 'John Doe',
  email: 'john@example.com'
})

await user.save()

// The userName field will be available in queries
const users = await User.objects.all()
console.log(users[0].userName) // "John Doe john@example.com"
```

### Default Values

You can specify default values for fields that will be used when creating new records:

```typescript
class User extends Model<User> {
  static fields: FieldsOf<User> = {
    id: new NumberField({ type: NumberFieldTypes.Int32 }),
    name: new StringField({ type: StringFieldTypes.String }),
    email: new StringField({ type: StringFieldTypes.String }),
    // Field with default value
    isActive: new BooleanField({ 
      type: BooleanFieldTypes.Boolean,
      defaultValue: true 
    }),
    // Field with default timestamp
    createdAt: new NumberField({ 
      type: NumberFieldTypes.Int64,
      defaultValue: Date.now() 
    })
  }

  static tableDefinition: TableDefinition<User> = {
    tableName: 'users',
    engine: 'MergeTree',
    orderBy: ['id']
  }
}

// When creating a user without specifying isActive or createdAt
const user = new User().create({
  name: 'John Doe',
  email: 'john@example.com'
})

// The default values will be used
console.log(user.values.isActive) // true
console.log(user.values.createdAt) // current timestamp
```

### Migrations

```typescript
import { MigrationService, MigrationRunner } from 'thunder-schema'

// Create a new migration
const migrationService = new MigrationService()
await migrationService.create('create_users_table')

// Run migrations
const migrationRunner = new MigrationRunner()
await migrationRunner.up()
```

## API Reference

### Models

- `Model`: Base class for all models
- `NumberField`: Field type for numeric values
- `StringField`: Field type for string values
- `TableDefinition`: Interface for table configuration

### Database

- `ConnectionManager`: Manages database connections
- `ConnectionConfig`: Type for connection configuration
- `ConnectionCredentials`: Type for connection credentials

### Query Building

- `QueryBuilder`: Build complex SQL queries

### Migrations

- `MigrationService`: Create and manage migrations
- `MigrationRunner`: Execute migrations

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[MIT License](LICENSE)
