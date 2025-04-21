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


await user.save()
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

### Database Migrations

Thunder Schema provides a robust migration system to manage your database schema changes. The migration system helps you version control your database schema and apply changes in a controlled manner.

#### Creating Migrations

To create migrations, first define your models and then run:

```bash
npm run makemigrations -- path/to/your/models.ts
```

This command will:
- Compare your current model definitions with existing migrations
- Generate a new migration file in the `migrations` directory
- Create the necessary SQL statements to update your database schema

#### Applying Migrations

Before applying migrations, ensure your database connection is properly configured through environment variables:

```bash
export CLICKHOUSE_URL=http://localhost:8123
export CLICKHOUSE_USERNAME=default
export CLICKHOUSE_PASSWORD=
export CLICKHOUSE_DATABASE=default
```

Then run:

```bash
npm run migrate
```

This will:
- Create a migrations table if it doesn't exist
- Apply any pending migrations in order
- Record the applied migrations in the database

#### Migration Types

The migration system supports several types of schema changes:

1. **CREATE**: Creating new tables
2. **UPDATE**: Modifying existing tables by:
   - Adding new columns
   - Removing columns
   - Updating column definitions
3. **DROP**: Dropping tables

#### Migration Diff Examples

Migration diffs are generated automatically when you run `makemigrations`. Here are examples of what different types of diffs look like:

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

The migration system automatically generates these diffs based on the changes in your model definitions. Each diff is stored in a separate migration file with a timestamp prefix (e.g., `1678901234567-migration.ts`).

#### Example Migration Workflow

1. Define your initial models
2. Generate the first migration:
```bash
npm run makemigrations -- src/models.ts
```

3. Apply the migration:
```bash
npm run migrate
```

4. When you need to make changes to your schema:
   - Update your model definitions
   - Generate a new migration:
```bash
npm run makemigrations -- src/models.ts
```
   - Apply the new migration:
```bash
npm run migrate
```

#### Viewing Migrations

You can view your existing migrations using:

```bash
npm run readmigrations
```

#### Migration Features

The migration system supports:

1. **Materialized Columns**: Computed columns that are stored in the table
2. **Default Values**: Automatic value assignment for new records
3. **Table Engine Configuration**: Support for various ClickHouse table engines
4. **Order By Clauses**: Define sorting order for MergeTree tables
5. **Partitioning**: Support for table partitioning

Example with advanced features:

```typescript
class User extends Model<UserSchema> {
  static fields: FieldsOf<UserSchema> = {
    id: new NumberField({}),
    name: new StringField({}),
    // Materialized column
    fullName: new StringField({
      expression: "concat(name, ' ', lastName)"
    }),
    // Column with default value
    createdAt: new NumberField({
      defaultValue: Date.now()
    })
  }

  static tableDefinition: TableDefinition<UserSchema> = {
    tableName: 'users',
    engine: 'MergeTree',
    orderBy: ['createdAt'],
    partitionBy: 'toYYYYMM(createdAt)',
    primaryKey: ['id']
  }
}
```

The migration system automatically tracks which migrations have been applied using a `migrations` table in your database and ensures migrations are applied in the correct order.

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
