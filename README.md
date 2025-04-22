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
import { Model } from 'thunder-schema'
import { FieldsOf, TableDefinition } from 'thunder-schema'
import { NumberField, StringField } from 'thunder-schema'

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
  credentials: {
    url: 'http://localhost:8123',
    username: 'default',
    password: '',
    database: 'default'
  },
  options: {
    keepAlive: true
  }
}

// Set as default connection
ConnectionManager.setDefault(config)

// Or get a specific instance
const connectionManager = ConnectionManager.getInstance(config)
```

### 3. Using the Model

```typescript
// Create a new user
const user = new User().create({
  id: 1,
  name: 'John Doe',
  email: 'john@example.com',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  deletedAt: 0
})

await user.save()
```

## Connection Management

The `ConnectionManager` is a singleton class that manages ClickHouse database connections. It provides several key features:

1. **Multi-tenancy Support**: You can have multiple connection instances for different databases/hosts
2. **Default Connection**: You can set a default connection configuration
3. **Connection Pooling**: It maintains connections and reuses them efficiently
4. **Type Safety**: It's fully typed with TypeScript

### Using Connection Manager with Models

You can pass connection configuration to models through the constructor:

```typescript
// Usage with specific connection
const user = new User(config)
const users = await user.objects.all()

// Usage with default connection
const defaultUser = new User()
const defaultUsers = await defaultUser.objects.all()
```

### Advanced Connection Management

The `ConnectionManager` provides several useful methods:

```typescript
// Create a new database
ConnectionManager.createDatabase('my_database')

// Execute operations within a connection context
await connectionManager.with(async (client) => {
  await client.query({ query: 'SELECT 1' })
})

// Close a specific connection
await connectionManager.close()

// Close all connections
await ConnectionManager.closeAll()
```

### Best Practices

1. **Default Connection**: Set up a default connection for your application:
```typescript
// In your application initialization
ConnectionManager.setDefault({
  credentials: {
    url: process.env.CLICKHOUSE_URL,
    username: process.env.CLICKHOUSE_USERNAME,
    password: process.env.CLICKHOUSE_PASSWORD,
    database: process.env.CLICKHOUSE_DATABASE
  }
})
```

2. **Multi-tenant Applications**: For multi-tenant applications, use different connection instances:
```typescript
// For tenant-specific operations
const tenantConfig: ConnectionConfig = {
  credentials: {
    url: tenant.url,
    username: tenant.username,
    password: tenant.password,
    database: tenant.database
  }
}

const tenantUser = new User(tenantConfig)
const tenantUsers = await tenantUser.objects.all()
```

3. **Connection Cleanup**: Always close connections when they're no longer needed:
```typescript
try {
  // Use the connection
} finally {
  await connectionManager.close()
}
```

### Error Handling

The `ConnectionManager` includes built-in error handling:

```typescript
try {
  await connectionManager.with(async (client) => {
    // Your database operations
  })
} catch (error) {
  // Handle connection or query errors
  console.error('Database error:', error)
}
```

## Advanced Usage

### Query Building

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

### Query Methods

The ORM provides several useful methods for querying and manipulating data:

#### Sorting Results

The `sort()` method allows you to sort query results by one or more fields:

```typescript
// Sort by a single field
const users = await User.objects
  .sort({ createdAt: -1 }) // -1 for descending, 1 for ascending
  .all()

// Sort by multiple fields
const users = await User.objects
  .sort({
    isActive: -1,  // Active users first
    createdAt: 1   // Then by creation date ascending
  })
  .all()
```

#### Counting Results

The `count()` method returns the number of records matching the query:

```typescript
// Count all users
const totalUsers = await User.objects.count()

// Count with filters
const activeUsers = await User.objects
  .filter({ isActive: true })
  .count()
```

#### Getting First Result

The `first()` method returns the first record matching the query:

```typescript
// Get first user
const firstUser = await User.objects.first()

// Get first active user
const firstActiveUser = await User.objects
  .filter({ isActive: true })
  .first()
```

#### Getting All Results

The `all()` method returns all records matching the query:

```typescript
// Get all users
const allUsers = await User.objects.all()

// Get all with filters and sorting
const activeUsers = await User.objects
  .filter({ isActive: true })
  .sort({ createdAt: -1 })
  .all()
```

#### Using FINAL Modifier

The `final()` method adds the FINAL modifier to the query, which is useful for ReplacingMergeTree tables to ensure you get the final version of each row:

```typescript
// Get final versions of rows
const finalUsers = await User.objects
  .final()
  .all()

// Combine with other methods
const finalActiveUsers = await User.objects
  .filter({ isActive: true })
  .final()
  .sort({ createdAt: -1 })
  .all()
```

Note: The `final()` method can only be used with ReplacingMergeTree tables and will throw an error if used with other table engines.

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
  id: 1,
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
    id: new NumberField({}),
    name: new StringField({}),
    email: new StringField({}),
    // Materialized field that concatenates name and email
    userName: new StringField({
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
  id: 1,
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
  id: 1,
  name: 'John Doe',
  email: 'john@example.com'
})

// The default values will be used
console.log(user.values.isActive) // true
console.log(user.values.createdAt) // current timestamp
```

## CLI Usage

The package provides a CLI tool called `thunder-schema` for managing migrations and database operations. Here are the available commands:

### Generate Migrations

Generate migration files from your model definitions:

```bash
npx thunder-schema makemigrations <model-path> [output-path]
```

- `model-path`: Path to your model files (default: './models')
- `output-path`: Path where migrations will be generated (default: './migrations')

Example:
```bash
npx thunder-schema makemigrations ./src/models ./migrations
```

### List Migrations

View all available migrations:

```bash
npx thunder-schema readmigrations [migrations-path]
```

- `migrations-path`: Path to your migrations directory (default: './migrations')

Example:
```bash
npx thunder-schema readmigrations ./migrations
```

### Apply Migrations

Apply pending migrations to your database:

```bash
npx thunder-schema migrate [migrations-path]
```

- `migrations-path`: Path to your migrations directory (default: './migrations')

Example:
```bash
npx thunder-schema migrate ./migrations
```

### Environment Variables

The CLI tool uses the following environment variables for database connection:
Thunder Schema provides a robust migration system to manage your database schema changes. The 
migration system helps you version control your database schema and apply changes in a 
controlled manner.
- `CLICKHOUSE_URL`: ClickHouse server URL (default: 'http://localhost:8123')
- `CLICKHOUSE_USERNAME`: ClickHouse username (default: 'default')
- `CLICKHOUSE_PASSWORD`: ClickHouse password (default: '')
- `CLICKHOUSE_DATABASE`: ClickHouse database name (default: 'default')

Example:
```bash
export CLICKHOUSE_URL=http://localhost:8123
export CLICKHOUSE_USERNAME=default
export CLICKHOUSE_PASSWORD=password
export CLICKHOUSE_DATABASE=my_database
npx thunder-schema migrate
```

## Migration Examples

Here are some examples of how to use migrations in your project:

### Basic Model Definition

```typescript
import { NumberField, StringField } from 'thunder-schema'
import { FieldsOf, TableDefinition } from 'thunder-schema'
import { Model } from 'thunder-schema'

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

type PostSchema = {
  id: string
  userId: string
  title: string
  content: string
  createdAt: number
  updatedAt: number
}

class Post extends Model<PostSchema> {
  static fields: FieldsOf<PostSchema> = {
    id: new StringField({}),
    userId: new StringField({}),
    title: new StringField({}),
    content: new StringField({}),
    createdAt: new NumberField({}),
    updatedAt: new NumberField({}),
  }

  static tableDefinition: TableDefinition<PostSchema> = {
    tableName: 'posts',
    engine: 'MergeTree',
    orderBy: ['createdAt'],
  }
}

const models: (typeof Model<any, any>)[] = [User, Post]

export default models
```

### Migration Types

The migration system supports several types of schema changes:

1. **CREATE**: Creating new tables
2. **UPDATE**: Modifying existing tables by:
   - Adding new columns
   - Removing columns
   - Updating column definitions
3. **DROP**: Dropping tables

### Example Migration Diffs

Here are examples of what different types of migration diffs look like:

1. **Creating a new table**:
```typescript
export const diff = [
  {
    changes: {
      type: 'CREATE',
      schema: {
        tableName: 'users',
        columns: [
          { name: 'id', type: 'Int32' },
          { name: 'name', type: 'String' },
          { name: 'email', type: 'String' },
          { name: 'createdAt', type: 'Int64', defaultValue: 'now()' }
        ],
        engine: 'MergeTree',
        orderBy: ['createdAt']
      }
    }
  }
]
```

2. **Adding new columns**:
```typescript
export const diff = [
  {
    changes: {
      type: 'UPDATE',
      tableName: 'users',
      add: [
        { name: 'lastName', type: 'String' },
        { name: 'age', type: 'Int32' }
      ]
    }
  }
]
```

3. **Removing columns**:
```typescript
export const diff = [
  {
    changes: {
      type: 'UPDATE',
      tableName: 'users',
      remove: ['deletedAt', 'isActive']
    }
  }
]
```

4. **Updating column definitions**:
```typescript
export const diff = [
  {
    changes: {
      type: 'UPDATE',
      tableName: 'users',
      update: [
        { 
          name: 'email', 
          type: 'String', 
          expression: "lower(email)" 
        }
      ]
    }
  }
]
```

5. **Dropping a table**:
```typescript
export const diff = [
  {
    changes: {
      type: 'DROP',
      schema: {
        tableName: 'old_users'
      }
    }
  }
]
```

6. **Complex changes** (multiple operations in one migration):
```typescript
export const diff = [
  {
    changes: {
      type: 'UPDATE',
      tableName: 'users',
      add: [
        { name: 'lastLogin', type: 'DateTime' }
      ],
      remove: ['lastActive'],
      update: [
        { 
          name: 'status', 
          type: 'String', 
          defaultValue: "'active'" 
        }
      ]
    }
  }
]
```