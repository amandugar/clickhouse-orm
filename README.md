# Thunder Schema

A TypeScript ORM for ClickHouse databases with type-safety at its core.

## Table of Contents
1. [Introduction](#introduction)
2. [Installation](#installation)
3. [Core Concepts](#core-concepts)
   - [Models](#models)
   - [Fields](#fields)
   - [Connection Management](#connection-management)
4. [Getting Started](#getting-started)
   - [Defining Models](#defining-models)
   - [Database Configuration](#database-configuration)
   - [Basic Operations](#basic-operations)
5. [Querying Data](#querying-data)
   - [Basic Queries](#basic-queries)
   - [Query Methods](#query-methods)
   - [Advanced Queries](#advanced-queries)
   - [Query Operators](#query-operators)
6. [Field Types & Options](#field-types--options)
   - [Basic Field Types](#basic-field-types)
   - [Common Options](#common-options)
   - [Array Fields](#array-fields)
   - [Tuple Fields](#tuple-fields)
   - [Materialized Fields](#materialized-fields)
7. [Migrations](#migrations)
   - [Migration Overview](#migration-overview)
   - [CLI Commands](#cli-commands)
   - [Migration Types](#migration-types)
   - [Migration Examples](#migration-examples)
   - [Migration Workflow](#migration-workflow)
   - [Environment Variables](#environment-variables)
8. [Advanced Features](#advanced-features)
   - [Connection Pooling](#connection-pooling)
   - [Complex Data Structures](#complex-data-structures)
   - [Query Building & Inspection](#query-building--inspection)
9. [API Reference](#api-reference)
10. [Contributing](#contributing)
11. [License](#license)

## Index of Data
- [User Model](#user-model)
- [Post Model](#post-model)
- [Product Model](#product-model)
- [Order Model](#order-model)
- [Matrix Model](#matrix-model)
- [UserProfile Model](#userprofile-model)

## Introduction

Thunder Schema is a TypeScript ORM for ClickHouse that provides a simple and type-safe way to interact with ClickHouse databases. It features type-safe model definitions, a powerful query builder, migration support, connection management, and a TypeScript-first approach.

## Installation

```bash
npm install thunder-schema
# or
yarn add thunder-schema
```

## Core Concepts

### Models

Models are the core building blocks in Thunder Schema. They represent tables in your ClickHouse database and provide a type-safe way to interact with your data. Each model has:

- **Schema**: A TypeScript type defining the table structure
- **Fields**: Field definitions with types and options
- **Table Definition**: Configuration for the table including engine and indexes

### Fields

Fields define the properties of your models. Each field has a type (like StringField, NumberField) and options (like default values, nullable settings).

### Connection Management

The ConnectionManager handles database connections and provides a centralized way to manage connection configuration. It supports multiple connections and connection pooling.


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


## Getting Started

### Defining Models

#### User Model

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

#### Post Model

```typescript
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
```

#### Product Model

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

#### Order Model

```typescript
// Migration file: 1678901278901-create_orders_table.ts
export const diff = [
  {
    changes: {
      type: 'CREATE',
      schema: {
        tableName: 'orders',
        columns: [
          { name: 'id', type: 'String' },
          { name: 'userId', type: 'String' },
          { name: 'productId', type: 'String' },
          { name: 'quantity', type: 'Int32', defaultValue: '1' },
          { name: 'price', type: 'Decimal(10, 2)' },
          { 
            name: 'totalPrice', 
            type: 'Decimal(10, 2)', 
            expression: 'quantity * price' 
          },
          { name: 'orderDate', type: 'DateTime', defaultValue: 'now()' },
          { name: 'status', type: 'String', defaultValue: "'pending'" }
        ],
        engine: 'MergeTree',
        orderBy: ['orderDate'],
        partitionBy: 'toYYYYMM(orderDate)',
        primaryKey: ['id']
      }
    }
  }
]
```

#### Matrix Model

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

#### UserProfile Model

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

### Database Configuration

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

### Basic Operations

Creating and saving a new record:

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

## Querying Data

### Basic Queries

```typescript
// Get all users
const allUsers = await User.objects.all()

// Filter by field
const activeUsers = await User.objects
  .filter({ isActive: true })
  .all()
```

### Query Methods

#### Sorting Results

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

```typescript
// Count all users
const totalUsers = await User.objects.count()

// Count with filters
const activeUsers = await User.objects
  .filter({ isActive: true })
  .count()
```

#### Getting First Result

```typescript
// Get first user
const firstUser = await User.objects.first()

// Get first active user
const firstActiveUser = await User.objects
  .filter({ isActive: true })
  .first()
```

#### Field Selection (Projection)

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

#### Using FINAL Modifier

```typescript
// Get final versions of rows
const finalUsers = await User.objects
  .final()
  .all()
```

### Advanced Queries

#### Nested Queries and Complex Conditions

```typescript
import { Q } from 'thunder-schema'

// Simple OR conditions
const query = User.objects.filter(
  new Q<User>().or([
    { id: 1 },
    { id: 2 }
  ])
)

// Complex nested conditions
const complexQuery = User.objects.filter(
  new Q<User>().or([
    new Q<User>().and([{ id: 1 }, { name: 'John' }]),
    new Q<User>().not(
      new Q<User>().or([{ id: 2 }, { email: 'test@test.com' }])
    )
  ])
)
```

#### Excluding Records

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

#### Async Iteration and Streaming

The ORM supports async iteration and streaming of results.

```typescript
// Using async iteration
const userInstance = new User()
const query = userInstance.objects.filter({ isActive: true })
for await (const user of query) {
  console.log(user)
}

/const allUsers = await userModel.objects.all()

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


### Query Operators

#### Comparison Operators

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

#### String Operators

```typescript
// Case-insensitive contains
{ name__icontains: 'john' } // name LIKE '%john%'
```

#### Set Operators

```typescript
// In set
{ status__in: ['active', 'pending'] } // status IN ('active', 'pending')
```

## Field Types & Options

### Basic Field Types

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

### Common Options

All field types support these options:

- `defaultValue`: Default value for the field
- `nullable`: Whether the field can be null
- `expression`: SQL expression for computed fields
- `materialized`: Whether the field is materialized

### Array Fields

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

### Tuple Fields

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

### Materialized Fields

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
}
```

## Migrations

### Migration Overview

Thunder Schema provides a robust migration system to manage database schema changes. The migration system helps you version control your database schema and apply changes in a controlled manner.

### CLI Commands

#### Generate Migrations

```bash
npx thunder-schema makemigrations <model-path> [output-path]
```

#### List Migrations

```bash
npx thunder-schema readmigrations [migrations-path]
```

#### Apply Migrations

```bash
npx thunder-schema migrate [migrations-path]
```

### Migration Types

The migration system supports several types of schema changes:

1. **CREATE**: Creating new tables
2. **UPDATE**: Modifying existing tables by:
   - Adding new columns
   - Removing columns
   - Updating column definitions
3. **DROP**: Dropping tables


#### Migration File Examples

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

### Migration Examples

Here are examples of different migration scenarios and their corresponding TypeScript migration files:

#### 1. Creating a New Table

When you first define a model, the migration system will generate a migration to create the corresponding table:

```typescript
// Migration file: 1678901234567-create_users_table.ts
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
          { name: 'createdAt', type: 'Int64', defaultValue: 'now()' },
          { name: 'updatedAt', type: 'Int64' },
          { name: 'deletedAt', type: 'Int64' }
        ],
        engine: 'MergeTree',
        orderBy: ['createdAt']
      }
    }
  }
]
```

#### 2. Adding New Columns

When you add new fields to your model, the migration system will generate a migration to add them to your table:

```typescript
// Migration file: 1678901245678-add_user_fields.ts
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

#### 3. Removing Columns

When you remove fields from your model, the migration system generates a migration to remove them from your table:

```typescript
// Migration file: 1678901256789-remove_user_fields.ts
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

#### 4. Updating Column Definitions

When you change a field's properties (like type or default value), the migration system generates a migration to update the column definition:

```typescript
// Migration file: 1678901267890-update_email_field.ts
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

#### 5. Creating a Table with Advanced Features

Here's an example of a more complex table creation with materialized columns, default values, and partitioning:

```typescript
// Migration file: 1678901278901-create_orders_table.ts
export const diff = [
  {
    changes: {
      type: 'CREATE',
      schema: {
        tableName: 'orders',
        columns: [
          { name: 'id', type: 'String' },
          { name: 'userId', type: 'String' },
          { name: 'productId', type: 'String' },
          { name: 'quantity', type: 'Int32', defaultValue: '1' },
          { name: 'price', type: 'Decimal(10, 2)' },
          { 
            name: 'totalPrice', 
            type: 'Decimal(10, 2)', 
            expression: 'quantity * price' 
          },
          { name: 'orderDate', type: 'DateTime', defaultValue: 'now()' },
          { name: 'status', type: 'String', defaultValue: "'pending'" }
        ],
        engine: 'MergeTree',
        orderBy: ['orderDate'],
        partitionBy: 'toYYYYMM(orderDate)',
        primaryKey: ['id']
      }
    }
  }
]
```

#### 6. Dropping a Table

When you remove a model altogether, the migration system can generate a migration to drop the table:

```typescript
// Migration file: 1678901289012-drop_old_table.ts
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

#### 7. Complex Multi-Table Migration

You can also have migrations that affect multiple tables in one go:

```typescript
// Migration file: 1678901299123-complex_migration.ts
export const diff = [
  {
    // Create a new table
    changes: {
      type: 'CREATE',
      schema: {
        tableName: 'products',
        columns: [
          { name: 'id', type: 'String' },
          { name: 'name', type: 'String' },
          { name: 'price', type: 'Decimal(10, 2)' },
          { name: 'createdAt', type: 'DateTime', defaultValue: 'now()' }
        ],
        engine: 'MergeTree',
        orderBy: ['id']
      }
    }
  },
  {
    // Update an existing table
    changes: {
      type: 'UPDATE',
      tableName: 'orders',
      add: [
        { name: 'discountCode', type: 'String', nullable: true }
      ],
      update: [
        { 
          name: 'totalPrice', 
          type: 'Decimal(10, 2)', 
          expression: 'price * quantity * (1 - if(discountCode != \'\', 0.1, 0))' 
        }
      ]
    }
  }
]
```

### Migration Workflow

1. Define your initial models
2. Generate the first migration:
```bash
npx thunder-schema makemigrations -m src/models.ts -o migrations
```
3. Apply the migration:
```bash
npx thunder-schema migrate --migrations-path migrations
```
4. When you need to make changes to your schema:
   - Update your model definitions
   - Generate a new migration
   - Apply the new migration

The migration system automatically tracks which migrations have been applied using a `migrations` table in your database and ensures migrations are applied in the correct order.

### Environment Variables

The CLI tool uses the following environment variables for database connection:

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

See more about it by running:
```bash
npx thunder-schema --help
```

## Advanced Features

### Connection Pooling

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


### Complex Data Structures

#### Nested Arrays

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

#### Tuple Filtering

```typescript
// Filter on nested tuple fields
const query = locationModel.objects.filter({
  location: {
    coordinates: {
      lat__gt: 40.0,
      lon__lt: -73.0
    },
  }
})
```

### Query Building & Inspection

```typescript
// Inspect the generated SQL query
const query = User.objects
  .filter({ isActive: true })
  .project(['id', 'name'])
  .getQuery()

console.log(query) // SELECT id, name FROM users WHERE (isActive = true)

// Reset query conditions
query.reset()
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