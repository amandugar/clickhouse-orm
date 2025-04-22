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

## Database Migrations

Thunder Schema provides a robust migration system to manage your database schema changes. The migration system helps you version control your database schema and apply changes in a controlled manner.

### Creating Migrations

To create migrations, first define your models and then run:

The first argument is the path to the model file and the second argument is the path to the migrations directory.

Your export file should be like this:

```typescript
import { NumberField, StringField } from '../models'
import { FieldsOf, TableDefinition } from '../models/types/table-definition'
import { Model } from '../models/model'

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

Then run:

```bash
npm run makemigrations -- src/example/model.ts src/example
```

This command will:
- Compare your current model definitions with existing migrations
- Generate a new migration file in the `migrations` directory
- Create the necessary SQL statements to update your database schema

### Applying Migrations

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

### Migration Types

The migration system supports several types of schema changes:

1. **CREATE**: Creating new tables
2. **UPDATE**: Modifying existing tables by:
   - Adding new columns
   - Removing columns
   - Updating column definitions
3. **DROP**: Dropping tables

### Migration Diff Examples

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

### Example Migration Workflow

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

### Viewing Migrations

You can view your existing migrations using:

```bash
npm run readmigrations
```

### Migration Features

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

## Advanced Query Building

### Projection and Field Selection

You can select specific fields using the `project()` method:

```typescript
// Select specific fields
const users = await User.objects
  .project(['id', 'name', 'email'])
  .all()

// Rename fields in the result
const users = await User.objects
  .project([
    'id',
    { name: 'fullName' },
    { email: 'contactEmail' }
  ])
  .all()
```

### Excluding Records

The `exclude()` method allows you to filter out records that match certain conditions:

```typescript
// Exclude specific records
const activeUsers = await User.objects
  .exclude({ isActive: false })
  .all()

// Complex exclusion conditions
const validUsers = await User.objects
  .exclude(
    new Q<User>().or([
      { email: null },
      { name: '' }
    ])
  )
  .all()
```

### Query Inspection and Debugging

You can inspect the generated SQL query:

```typescript
const query = User.objects
  .filter({ isActive: true })
  .project(['id', 'name'])
  .getQuery()

console.log(query) // SELECT id, name FROM users WHERE (isActive = true)
```

### Resetting Queries

The `reset()` method clears all query conditions:

```typescript
const query = User.objects
  .filter({ isActive: true })
  .project(['id', 'name'])

// Clear all conditions
query.reset()

// Now query is back to SELECT * FROM users
```

## Field Types and Options

### Available Field Types

1. **NumberField**: For numeric values
   ```typescript
   new NumberField({
     defaultValue: 0,
     nullable: false
   })
   ```

2. **StringField**: For text values
   ```typescript
   new StringField({
     defaultValue: '',
     nullable: true,
     maxLength: 255
   })
   ```

3. **BooleanField**: For true/false values
   ```typescript
   new BooleanField({
     defaultValue: false
   })
   ```

4. **DateTimeField**: For date and time values
   ```typescript
   new DateTimeField({
     defaultValue: 'now()',
     timezone: 'UTC'
   })
   ```

5. **ArrayField**: For array values
   ```typescript
   new ArrayField({
     elementType: 'String',
     defaultValue: []
   })
   ```

### Field Options

All field types support the following options:

- `defaultValue`: Default value for the field
- `nullable`: Whether the field can be null
- `expression`: SQL expression for computed fields
- `materialized`: Whether the field is materialized

## Advanced Connection Management

### Connection Pooling

The `ConnectionManager` implements connection pooling for better performance:

```typescript
const config: ConnectionConfig = {
  credentials: {
    url: 'http://localhost:8123',
    username: 'default',
    password: '',
    database: 'default'
  },
  options: {
    keepAlive: true,
  }
}
```

## Query Operators

The query builder supports various operators for building complex queries. Here's how to use them:

### Comparison Operators

```typescript
// Greater than
{ age__gt: 18 } // age > 18

// Less than
{ age__lt: 65 } // age < 65

// Greater than or equal
{ age__gte: 18 } // age >= 18

// Less than or equal
{ age__lte: 65 } // age <= 65

// Not equal
{ status__ne: 'inactive' } // status != 'inactive'
```

### String Operators

```typescript
// Case-insensitive contains
{ name__icontains: 'john' } // name LIKE '%john%'
```

### Set Operators

```typescript
// In set
{ status__in: ['active', 'pending'] } // status IN ('active', 'pending')
```

### Logical Operators

```typescript
// AND operator
new Q().and([
  { age__gt: 18 },
  { status: 'active' }
])
// (age > 18 AND status = 'active')

// OR operator
new Q().or([
  { status: 'active' },
  { status: 'pending' }
])
// (status = 'active' OR status = 'pending')

// NOT operator
new Q().not({ status: 'inactive' })
// NOT (status = 'inactive')
```

### Complex Queries

You can combine operators to create complex queries:

```typescript
// Nested conditions with AND and OR
new Q().and([
  { age__gt: 18 },
  new Q().or([
    { status: 'active' },
    { status: 'pending' }
  ])
])
// (age > 18 AND (status = 'active' OR status = 'pending'))

// Multiple conditions with NOT
new Q().not({
  age__gt: 18,
  status__in: ['active', 'pending']
})
// NOT (age > 18 AND status IN ('active', 'pending'))

// Complex string matching
new Q().and([
  { name__icontains: 'john' },
  { email__icontains: 'example.com' }
])
// (name LIKE '%john%' AND email LIKE '%example.com%')
```

### Edge Cases

```typescript
// Empty conditions
new Q().not({}) // No conditions

// Null values
new Q().not({ name: undefined }) // NOT (name = NULL)

// Boolean values
new Q().not({ isActive: true }) // NOT (isActive = true)

// Multiple NOT operations
new Q().not(new Q().not({ id: 1 })) // NOT (NOT (id = 1))

// Empty arrays in IN operator
new Q().not({ id__in: [] }) // NOT (id IN ())
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
- `Q`: Class for building query conditions

### Migrations

- `MigrationService`: Create and manage migrations
- `MigrationRunner`: Execute migrations

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[MIT License](LICENSE)

### Array Fields and Nested Structures

The ORM supports array fields and nested structures like arrays within tuples. Here's how to use them:

#### Basic Array Fields

```typescript
class Product extends Model<ProductSchema> {
  static fields = {
    id: new NumberField({}),
    tags: new ArrayField({
      elementType: new StringField({ defaultValue: '' }),
      defaultValue: ['new', 'featured'],
    }),
    prices: new ArrayField({
      elementType: new NumberField({ defaultValue: 0 }),
      defaultValue: [10, 20, 30],
    }),
  }
}
```

#### Nested Arrays

You can create arrays of arrays for more complex data structures:

```typescript
class Matrix extends Model<MatrixSchema> {
  static fields = {
    id: new NumberField({}),
    data: new ArrayField({
      elementType: new ArrayField({
        elementType: new NumberField({ defaultValue: 0 }),
        defaultValue: [],
      }),
      defaultValue: [[1, 2], [3, 4]],
    }),
  }
}
```

#### Tuples with Arrays

You can combine tuples and arrays for complex nested structures:

```typescript
class UserProfile extends Model<UserProfileSchema> {
  static fields = {
    id: new NumberField({}),
    preferences: new TupleField({
      fields: {
        name: new StringField({ defaultValue: '' }),
        favoriteNumbers: new ArrayField({
          elementType: new NumberField({ defaultValue: 0 }),
          defaultValue: [1, 2, 3],
        }),
      },
    }),
  }
}
```

The above will generate a schema with a tuple field containing a string and an array of numbers:
```sql
Tuple(name String, favoriteNumbers Array(Int32))
```

#### Default Values

Array fields support default values at both the array and element level:

```typescript
new ArrayField({
  elementType: new StringField({ defaultValue: 'default' }), // Element default
  defaultValue: ['value1', 'value2'], // Array default
})
```