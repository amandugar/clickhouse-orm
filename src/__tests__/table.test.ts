import { BooleanField, Model, NumberField, StringField } from '../models'
import {
  FieldsOf,
  MergeTreeTableDefinition,
} from '../models/types/table-definition'
import { Q } from '../models/query-builder'
import { MigrationRunner } from '../services/MigrationRunner'
import {
  ConnectionCredentials,
  ConnectionManager,
} from '../utils/database/connection-manager'
import { Engine } from '../utils/engines/engines'
import {
  BooleanFieldTypes,
  NumberFieldTypes,
  StringFieldTypes,
} from '../models/fields/field-types'

type User = {
  id: number
  name: string
  email: string
  isActive: boolean
}

type UserMaterialized = {
  userName: string
}

class UserModel extends Model<User, UserMaterialized> {
  static fields: FieldsOf<User & UserMaterialized> = {
    id: new NumberField({ type: NumberFieldTypes.Int32 }),
    name: new StringField({ type: StringFieldTypes.String }),
    email: new StringField({ type: StringFieldTypes.String }),
    isActive: new BooleanField({ type: BooleanFieldTypes.Boolean }),
    userName: new StringField({
      type: StringFieldTypes.String,
      expression: "concat(name, ' ', email)",
    }),
  }

  static tableDefinition: MergeTreeTableDefinition<User> = {
    engine: Engine.MERGE_TREE,
    partitionBy: 'name',
    orderBy: ['id'],
    tableName: 'users',
    primaryKey: ['id'],
  }
}

UserModel.init()

const credentials: ConnectionCredentials = {
  url: 'http://localhost:8123',
  username: 'default',
  database: 'test',
  password: '',
}

describe('Model', () => {
  beforeAll(async () => {
    ConnectionManager.setDefault({ credentials })
    ConnectionManager.createDatabase('test')
  })

  it('should create a table statement', async () => {
    const table = UserModel.generateSchema()
    const runner = new MigrationRunner(credentials)
    await runner.createTable(table)

    UserModel.init()
    const user = new UserModel().create({
      email: 'test@test.com',
      name: 'Test',
      id: 1,
      isActive: true,
    })

    await user.save()

    expect(MigrationRunner.createTableStatement(table)).toBe(
      "CREATE TABLE IF NOT EXISTS users (id Int32, name String, email String, isActive Boolean, userName String MATERIALIZED concat(name, ' ', email)) ENGINE = MergeTree PARTITION BY name PRIMARY KEY (id) ORDER BY (id)",
    )

    const user2 = new UserModel({
      credentials,
    }).create({
      email: 'test3@test.com',
      name: 'Test2',
      id: 3,
      isActive: false,
    })

    await user2.save()
    const query = user2.objects.filter({ email: 'test3@test.com' })

    for await (const row of query) {
      expect(row.email).toBe('test3@test.com')
    }

    const query2 = query.exclude({ id: 3 })

    for await (const row of query2) {
      expect(row.id).not.toBe(3)
    }
  })

  it('should create a query builder', async () => {
    const user1 = new UserModel()

    const queryData = user1.objects

    const queryData2 = queryData.filter(
      new Q<User>().or([
        { id: 1 },
        { id: 2 },
        new Q<User>().and([{ id: 3 }, { email: 'test@test.com' }]),
      ]),
    )
    /**
     * QUery should be:
     * SELECT * FROM users WHERE (id = 1 OR id = 2)
     */
    const queryRightNow = queryData2.getQuery()
    expect(queryRightNow).toBe(
      "SELECT * FROM users WHERE (((id = 1)) OR ((id = 2)) OR (((id = 3)) AND ((email = 'test@test.com'))))",
    )
  })

  it('should create a query builder with not', async () => {
    const user1 = new UserModel()

    const queryData = user1.objects.filter(
      new Q<User>().not(new Q<User>().or([{ id: 1 }, { id: 2 }])),
    )

    const queryRightNow = queryData.getQuery()
    expect(queryRightNow).toBe(
      'SELECT * FROM users WHERE (NOT (((id = 1)) OR ((id = 2))))',
    )

    const query = new UserModel()

    const queryData2 = query.objects.filter(
      new Q<User>().or([
        new Q<User>().and([{ id: 1 }, { name: 'John' }]),
        new Q<User>().not(
          new Q<User>().or([{ id: 2 }, { email: 'test@test.com' }]),
        ),
      ]),
    )

    const queryRightNow2 = queryData2.getQuery()
    expect(queryRightNow2).toBe(
      "SELECT * FROM users WHERE ((((id = 1)) AND ((name = 'John'))) OR ((NOT (((id = 2)) OR ((email = 'test@test.com'))))))",
    )

    const count = await queryData2.count()
    expect(count).toBeGreaterThan(0)
  })

  it('should handle comparison operators', async () => {
    const user1 = new UserModel()

    // Test greater than
    const gtQuery = user1.objects.filter({ id__gt: 5 })
    expect(gtQuery.getQuery()).toBe('SELECT * FROM users WHERE (id > 5)')

    // Test less than
    const ltQuery = user1.objects.filter({ id__lt: 10 })
    expect(ltQuery.getQuery()).toBe('SELECT * FROM users WHERE (id < 10)')

    // Test greater than or equal
    const gteQuery = user1.objects.filter({ id__gte: 5 })
    expect(gteQuery.getQuery()).toBe('SELECT * FROM users WHERE (id >= 5)')

    // Test less than or equal
    const lteQuery = user1.objects.filter({ id__lte: 10 })
    expect(lteQuery.getQuery()).toBe('SELECT * FROM users WHERE (id <= 10)')

    // Test not equal
    const neQuery = user1.objects.filter({ id__ne: 5 })
    expect(neQuery.getQuery()).toBe('SELECT * FROM users WHERE (id != 5)')
  })

  it('should handle LIKE operator', async () => {
    const user1 = new UserModel()

    // Test contains
    const containsQuery = user1.objects.filter({ name__icontains: 'john' })
    expect(containsQuery.getQuery()).toBe(
      "SELECT * FROM users WHERE (name LIKE '%john%')",
    )

    // Test starts with
    const startsWithQuery = user1.objects.filter({ name__icontains: 'john%' })
    expect(startsWithQuery.getQuery()).toBe(
      "SELECT * FROM users WHERE (name LIKE '%john%%')",
    )

    // Test ends with
    const endsWithQuery = user1.objects.filter({ name__icontains: '%doe' })
    expect(endsWithQuery.getQuery()).toBe(
      "SELECT * FROM users WHERE (name LIKE '%%doe%')",
    )
  })

  it('should handle IN operator', async () => {
    const user1 = new UserModel()

    // Test IN with numbers
    const inQuery = user1.objects.filter({ id__in: [1, 2, 3] })
    expect(inQuery.getQuery()).toBe(
      "SELECT * FROM users WHERE (id IN ('1', '2', '3'))",
    )

    // Test IN with strings
    const inQueryStrings = user1.objects.filter({ name__in: ['John', 'Jane'] })
    expect(inQueryStrings.getQuery()).toBe(
      "SELECT * FROM users WHERE (name IN ('John', 'Jane'))",
    )
  })

  it('should handle complex combinations of operators', async () => {
    const user1 = new UserModel()

    // Test multiple operators in a single filter
    const complexQuery = user1.objects.filter({
      id__gt: 5,
      id__lt: 10,
      name__icontains: 'john',
    })
    expect(complexQuery.getQuery()).toBe(
      "SELECT * FROM users WHERE ((id > 5) AND (id < 10) AND (name LIKE '%john%'))",
    )

    // Test NOT with comparison operators
    const notGtQuery = user1.objects.filter(new Q<User>().not({ id__gt: 5 }))
    expect(notGtQuery.getQuery()).toBe(
      'SELECT * FROM users WHERE (NOT ((id > 5)))',
    )

    // Test OR with different operators
    const orQuery = user1.objects.filter(
      new Q<User>().or([
        { id__gt: 5 },
        { name__icontains: 'john' },
        { id__in: [1, 2, 3] },
      ]),
    )
    expect(orQuery.getQuery()).toBe(
      "SELECT * FROM users WHERE (((id > 5)) OR ((name LIKE '%john%')) OR ((id IN ('1', '2', '3'))))",
    )
  })

  it('should handle nested conditions with operators', async () => {
    const user1 = new UserModel()

    // Test nested AND with different operators
    const nestedAndQuery = user1.objects.filter(
      new Q<User>().and([
        { id__gt: 5 },
        { name__icontains: 'john' },
        new Q<User>().or([{ id__lt: 10 }, { id__in: [1, 2, 3] }]),
      ]),
    )
    expect(nestedAndQuery.getQuery()).toBe(
      "SELECT * FROM users WHERE (((id > 5)) AND ((name LIKE '%john%')) AND (((id < 10)) OR ((id IN ('1', '2', '3')))))",
    )

    // Test NOT with nested conditions
    const notNestedQuery = user1.objects.filter(
      new Q<User>().not(
        new Q<User>().and([{ id__gt: 5 }, { name__icontains: 'john' }]),
      ),
    )
    expect(notNestedQuery.getQuery()).toBe(
      "SELECT * FROM users WHERE (NOT (((id > 5)) AND ((name LIKE '%john%'))))",
    )
  })

  it('should maintain instances', async () => {
    const user1 = new UserModel()

    const queryData = user1.objects.filter(
      new Q<User>().or([{ id: 1 }, { id: 2 }]),
    )

    const queryData2 = queryData.filter(
      new Q<User>().or([{ id: 3 }, { id: 4 }]),
    )

    const queryData3 = user1.objects.filter(
      new Q<User>().or([{ id: 5 }, { id: 6 }]),
    )

    const queryRightNow = queryData.getQuery()
    expect(queryRightNow).toBe(
      'SELECT * FROM users WHERE (((id = 1)) OR ((id = 2)))',
    )
    expect(queryData2.getQuery()).toBe(
      'SELECT * FROM users WHERE (((id = 1)) OR ((id = 2)) OR ((id = 3)) OR ((id = 4)))',
    )

    const queryRightNow3 = queryData3.getQuery()
    expect(queryRightNow3).toBe(
      'SELECT * FROM users WHERE (((id = 5)) OR ((id = 6)))',
    )
  })

  it('should handle NOT operator with various conditions', async () => {
    const user1 = new UserModel()

    // Test NOT with simple condition
    const notSimpleQuery = user1.objects.filter(new Q<User>().not({ id: 1 }))
    expect(notSimpleQuery.getQuery()).toBe(
      'SELECT * FROM users WHERE (NOT ((id = 1)))',
    )

    // Test NOT with comparison operator
    const notGtQuery = user1.objects.filter(new Q<User>().not({ id__gt: 5 }))
    expect(notGtQuery.getQuery()).toBe(
      'SELECT * FROM users WHERE (NOT ((id > 5)))',
    )

    // Test NOT with LIKE operator
    const notLikeQuery = user1.objects.filter(
      new Q<User>().not({ name__icontains: 'john' }),
    )
    expect(notLikeQuery.getQuery()).toBe(
      "SELECT * FROM users WHERE (NOT ((name LIKE '%john%')))",
    )

    // Test NOT with IN operator
    const notInQuery = user1.objects.filter(
      new Q<User>().not({ id__in: [1, 2, 3] }),
    )
    expect(notInQuery.getQuery()).toBe(
      "SELECT * FROM users WHERE (NOT ((id IN ('1', '2', '3'))))",
    )

    // Test NOT with multiple conditions
    const notMultipleQuery = user1.objects.filter(
      new Q<User>().not({
        id__gt: 5,
        name__icontains: 'john',
      }),
    )
    expect(notMultipleQuery.getQuery()).toBe(
      "SELECT * FROM users WHERE (NOT ((id > 5) AND (name LIKE '%john%')))",
    )

    // Test NOT with nested OR conditions
    const notNestedOrQuery = user1.objects.filter(
      new Q<User>().not(
        new Q<User>().or([
          { id: 1 },
          { name: 'John' },
          { email: 'test@test.com' },
        ]),
      ),
    )
    expect(notNestedOrQuery.getQuery()).toBe(
      "SELECT * FROM users WHERE (NOT (((id = 1)) OR ((name = 'John')) OR ((email = 'test@test.com'))))",
    )

    // Test NOT with nested AND conditions
    const notNestedAndQuery = user1.objects.filter(
      new Q<User>().not(
        new Q<User>().and([
          { id__gt: 5 },
          { name__icontains: 'john' },
          { email: 'test@test.com' },
        ]),
      ),
    )
    expect(notNestedAndQuery.getQuery()).toBe(
      "SELECT * FROM users WHERE (NOT (((id > 5)) AND ((name LIKE '%john%')) AND ((email = 'test@test.com'))))",
    )

    // Test NOT with complex nested conditions
    const notComplexQuery = user1.objects.filter(
      new Q<User>().not(
        new Q<User>().or([
          new Q<User>().and([{ id: 1 }, { name: 'John' }]),
          new Q<User>().and([{ id: 2 }, { email: 'test@test.com' }]),
        ]),
      ),
    )
    expect(notComplexQuery.getQuery()).toBe(
      "SELECT * FROM users WHERE (NOT ((((id = 1)) AND ((name = 'John'))) OR (((id = 2)) AND ((email = 'test@test.com')))))",
    )

    // Test NOT with multiple NOT conditions
    const notMultipleNotQuery = user1.objects.filter(
      new Q<User>().and([
        new Q<User>().not({ id: 1 }),
        new Q<User>().not({ name: 'John' }),
      ]),
    )
    expect(notMultipleNotQuery.getQuery()).toBe(
      "SELECT * FROM users WHERE (((NOT ((id = 1)))) AND ((NOT ((name = 'John')))))",
    )
  })

  it('should handle NOT operator edge cases', async () => {
    const user1 = new UserModel()

    // Test NOT with empty conditions
    const notEmptyQuery = user1.objects.filter(new Q<User>().not({}))
    expect(notEmptyQuery.getQuery()).toBe(
      'SELECT * FROM users WHERE (NOT NULL)',
    )

    // Test NOT with undefined values
    const notUndefinedQuery = user1.objects.filter(
      new Q<User>().not({ name: undefined }),
    )
    expect(notUndefinedQuery.getQuery()).toBe(
      'SELECT * FROM users WHERE (NOT ((name IS NULL)))',
    )

    // Test NOT with boolean values
    const notBooleanQuery = user1.objects.filter(
      new Q<User>().not({ isActive: true }),
    )
    expect(notBooleanQuery.getQuery()).toBe(
      'SELECT * FROM users WHERE (NOT ((isActive = true)))',
    )

    // Test NOT with multiple NOT operations
    const doubleNotQuery = user1.objects.filter(
      new Q<User>().not(new Q<User>().not({ id: 1 })),
    )
    expect(doubleNotQuery.getQuery()).toBe(
      'SELECT * FROM users WHERE (NOT ((NOT ((id = 1)))))',
    )

    // Test NOT with mixed operators
    const mixedOperatorsQuery = user1.objects.filter(
      new Q<User>().not({
        id__gt: 5,
        id__lt: 10,
        name__icontains: 'john',
        email: 'test@test.com',
      }),
    )
    expect(mixedOperatorsQuery.getQuery()).toBe(
      "SELECT * FROM users WHERE (NOT ((id > 5) AND (id < 10) AND (name LIKE '%john%') AND (email = 'test@test.com')))",
    )

    // Test NOT with deeply nested conditions
    const deepNestedQuery = user1.objects.filter(
      new Q<User>().not(
        new Q<User>().or([
          new Q<User>().and([
            { id__gt: 5 },
            new Q<User>().or([
              { name__icontains: 'john' },
              { email: 'test@test.com' },
            ]),
          ]),
          new Q<User>().and([{ id__lt: 10 }, { name__icontains: 'jane' }]),
        ]),
      ),
    )
    expect(deepNestedQuery.getQuery()).toBe(
      "SELECT * FROM users WHERE (NOT ((((id > 5)) AND (((name LIKE '%john%')) OR ((email = 'test@test.com')))) OR (((id < 10)) AND ((name LIKE '%jane%')))))",
    )

    // Test NOT with multiple groups
    const multipleGroupsQuery = user1.objects.filter(
      new Q<User>().and([
        new Q<User>().not({ id: 1 }),
        new Q<User>().not(
          new Q<User>().or([{ name: 'John' }, { email: 'test@test.com' }]),
        ),
      ]),
    )
    expect(multipleGroupsQuery.getQuery()).toBe(
      "SELECT * FROM users WHERE (((NOT ((id = 1)))) AND ((NOT (((name = 'John')) OR ((email = 'test@test.com'))))))",
    )

    // Test NOT with multiple conditions on the same field
    const sameFieldQuery = user1.objects.filter(
      new Q<User>().not({
        id__gt: 5,
        id__lt: 10,
      }),
    )
    expect(sameFieldQuery.getQuery()).toBe(
      'SELECT * FROM users WHERE (NOT ((id > 5) AND (id < 10)))',
    )

    // Test NOT with IN operator and empty array
    const emptyInQuery = user1.objects.filter(new Q<User>().not({ id__in: [] }))
    expect(emptyInQuery.getQuery()).toBe(
      'SELECT * FROM users WHERE (NOT ((id IN (NULL))))',
    )
  })

  it('should handle IN operator with Model instances', async () => {
    const user1 = new UserModel()
    const user2 = new UserModel()

    // Create a filtered query
    const filteredQuery = user2.objects.filter({ id__gt: 5 })

    // Use the filtered query in an IN condition
    const inQueryWithModel = user1.objects.filter({ id__in: filteredQuery })
    expect(inQueryWithModel.getQuery()).toBe(
      'SELECT * FROM users WHERE (id IN (SELECT * FROM users WHERE (id > 5)))',
    )
  })
})
