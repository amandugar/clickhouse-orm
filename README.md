# ClickHouse ORM

A TypeScript ORM for ClickHouse with migrations support.

## Features

- Type-safe query building
- Model definitions with TypeScript
- Database migrations
- Connection management
- Support for materialized views
- Async/await support

## Installation

```bash
npm install clickhouse-orm
```

## Quick Start

```typescript
import {
  Model,
  StringField,
  NumberField,
  TableDefinition,
} from 'clickhouse-orm'

// Define your model
class User extends Model<User> {
  static tableDefinition: TableDefinition<User> = {
    tableName: 'users',
    engine: 'MergeTree',
    orderBy: ['id'],
  }

  protected static fields = {
    id: new NumberField({}),
    name: new StringField({}),
    email: new StringField({}),
  }
}

// Create a new user
const user = new User().create({
  id: 1,
  name: 'John Doe',
  email: 'john@example.com',
})

// Save to database
await user.save()

// Query users
const users = await User.objects.all()
```

## Migrations

The package includes a migration system to manage your database schema:

```bash
# Generate migrations
npm run makemigrations -- path/to/models.ts

# Apply migrations
npm run migrate
```

## Documentation

For detailed documentation, please visit [documentation link].

## License

ISC
