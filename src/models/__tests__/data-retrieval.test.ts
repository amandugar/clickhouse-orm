import { Model } from '../model'
import { NumberField, StringField } from '../fields'
import { Engine } from '../../utils/engines/engines'
import { FieldsOf, TableDefinition } from '../types/table-definition'
import { NumberFieldTypes, StringFieldTypes } from '../fields/field-types'
import {
  ConnectionCredentials,
  ConnectionManager,
} from '../../utils/database/connection-manager'
import { MigrationRunner } from '../../services/MigrationRunner'

type TestUser = {
  id: number
  name: string
  email: string
  age: number
}

class TestUserModel extends Model<TestUser> {
  static fields: FieldsOf<TestUser> = {
    id: new NumberField({ type: NumberFieldTypes.Int32 }),
    name: new StringField({ type: StringFieldTypes.String }),
    email: new StringField({ type: StringFieldTypes.String }),
    age: new NumberField({ type: NumberFieldTypes.Int32 }),
  }

  static tableDefinition: TableDefinition<TestUser> = {
    tableName: 'test_users',
    engine: Engine.MERGE_TREE,
    orderBy: ['id'],
  }
}

const connectionConfig: ConnectionCredentials = {
  url: 'http://localhost:8123',
  username: 'default',
  password: '',
  database: 'default',
}

describe('DataRetrival', () => {
  beforeAll(async () => {
    ConnectionManager.setDefault({ credentials: connectionConfig })
    await ConnectionManager.createDatabase('default')
  })

  beforeAll(async () => {
    // Clean up existing data
    const connectionManager = ConnectionManager.getDefaultOrCreate()
    await connectionManager.with(async (client) => {
      await client.exec({ query: 'DROP TABLE IF EXISTS test_users' })
    })

    TestUserModel.init()
    const table = TestUserModel.generateSchema()
    const runner = new MigrationRunner(connectionConfig)
    await runner.createTable(table)

    // Insert test data in specific order
    const user = new TestUserModel()
    await user
      .create({ id: 1, name: 'Alice', email: 'alice@test.com', age: 25 })
      .save()
    await user
      .create({ id: 2, name: 'Bob', email: 'bob@test.com', age: 30 })
      .save()
    await user
      .create({ id: 3, name: 'Charlie', email: 'charlie@test.com', age: 35 })
      .save()
    await user
      .create({ id: 4, name: 'Diana', email: 'diana@test.com', age: 28 })
      .save()
  })

  afterAll(async () => {
    // Clean up after each test
    const connectionManager = ConnectionManager.getDefaultOrCreate()
    await connectionManager.with(async (client) => {
      await client.exec({ query: 'DROP TABLE IF EXISTS test_users' })
    })
  })

  afterAll(async () => {
    await ConnectionManager.closeAll()
  })

  describe('.next() method', () => {
    it('should return the first element when called for the first time', async () => {
      const query = new TestUserModel().objects
        .filter({ age__gte: 25 })
        .sort({ id: 1 })

      const firstUser = await query.next()

      expect(firstUser).toBeDefined()
      expect(firstUser?.id).toBe(1)
      expect(firstUser?.name).toBe('Alice')
      expect(firstUser?.email).toBe('alice@test.com')
      expect(firstUser?.age).toBe(25)
    })

    it('should return subsequent elements on consecutive calls', async () => {
      const query = new TestUserModel().objects
        .filter({ age__gte: 25 })
        .limit(3)
        .sort({ id: 1 })

      const firstUser = await query.next()
      const secondUser = await query.next()
      const thirdUser = await query.next()

      expect(firstUser?.id).toBe(1)
      expect(secondUser?.id).toBe(2)
      expect(thirdUser?.id).toBe(3)
    })

    it('should return undefined when no more elements are available', async () => {
      const query = new TestUserModel().objects.filter({ id: 999 }) // No matching records

      const result = await query.next()

      expect(result).toBeUndefined()
    })

    it('should return undefined after all elements have been consumed', async () => {
      const query = new TestUserModel().objects.limit(2)

      const firstUser = await query.next()
      const secondUser = await query.next()
      const thirdUser = await query.next()

      expect(firstUser).toBeDefined()
      expect(secondUser).toBeDefined()
      expect(thirdUser).toBeUndefined()
    })

    it('should maintain iterator state between calls', async () => {
      const query = new TestUserModel().objects
        .filter({ age__gte: 25 })
        .limit(3)
        .sort({ id: 1 })

      // First call
      const firstUser = await query.next()
      expect(firstUser?.id).toBe(1)

      // Second call - should continue from where we left off
      const secondUser = await query.next()
      expect(secondUser?.id).toBe(2)

      // Third call
      const thirdUser = await query.next()
      expect(thirdUser?.id).toBe(3)

      // Fourth call - should be undefined
      const fourthUser = await query.next()
      expect(fourthUser).toBeUndefined()
    })

    it('should work with filtered queries', async () => {
      const query = new TestUserModel().objects.filter({ age__gt: 25 })

      const firstUser = await query.next()
      const secondUser = await query.next()
      const thirdUser = await query.next()

      expect(firstUser?.age).toBeGreaterThan(25)
      expect(secondUser?.age).toBeGreaterThan(25)
      expect(thirdUser?.age).toBeGreaterThan(25)
    })

    it('should work with sorted queries', async () => {
      const query = new TestUserModel().objects.sort({ age: -1 }).limit(3)

      const firstUser = await query.next()
      const secondUser = await query.next()
      const thirdUser = await query.next()

      expect(firstUser?.age).toBe(35) // Charlie
      expect(secondUser?.age).toBe(30) // Bob
      expect(thirdUser?.age).toBe(28) // Diana
    })
  })

  describe('.resetIterator() method', () => {
    it('should reset the iterator and allow reading from the beginning again', async () => {
      const query = new TestUserModel().objects.limit(2)

      // First iteration
      const firstUser1 = await query.next()
      const secondUser1 = await query.next()
      const thirdUser1 = await query.next()

      expect(firstUser1?.id).toBe(1)
      expect(secondUser1?.id).toBe(2)
      expect(thirdUser1).toBeUndefined()

      // Reset iterator
      query.resetIterator()

      // Second iteration - should start from the beginning
      const firstUser2 = await query.next()
      const secondUser2 = await query.next()
      const thirdUser2 = await query.next()

      expect(firstUser2?.id).toBe(1)
      expect(secondUser2?.id).toBe(2)
      expect(thirdUser2).toBeUndefined()
    })

    it('should work with filtered queries after reset', async () => {
      const query = new TestUserModel().objects.filter({ age__gt: 25 }).limit(2)

      // First iteration
      const firstUser1 = await query.next()
      const secondUser1 = await query.next()
      const thirdUser1 = await query.next()

      expect(firstUser1?.age).toBeGreaterThan(25)
      expect(secondUser1?.age).toBeGreaterThan(25)
      expect(thirdUser1).toBeUndefined()

      // Reset iterator
      query.resetIterator()

      // Second iteration
      const firstUser2 = await query.next()
      const secondUser2 = await query.next()

      expect(firstUser2?.age).toBeGreaterThan(25)
      expect(secondUser2?.age).toBeGreaterThan(25)
    })

    it('should maintain query conditions after reset', async () => {
      const query = new TestUserModel().objects
        .filter({ name__icontains: 'a' })
        .limit(2)

      // First iteration
      const firstUser1 = await query.next()
      const secondUser1 = await query.next()

      expect(firstUser1?.name).toMatch(/a/i)
      expect(secondUser1?.name).toMatch(/a/i)

      // Reset iterator
      query.resetIterator()

      // Second iteration - should still apply the same filter
      const firstUser2 = await query.next()
      const secondUser2 = await query.next()

      expect(firstUser2?.name).toMatch(/a/i)
      expect(secondUser2?.name).toMatch(/a/i)
    })
  })

  describe('Integration with existing methods', () => {
    it('should work alongside the async iterator', async () => {
      const query = new TestUserModel().objects.limit(3).sort({ id: 1 })

      // Use .next() to get first element
      const firstUser = await query.next()
      expect(firstUser?.id).toBe(1)

      // Use async iterator for the rest
      const remainingUsers: TestUser[] = []
      for await (const user of query) {
        remainingUsers.push(user)
      }

      expect(remainingUsers.length).toBe(2)
      expect(remainingUsers[0].id).toBe(2)
      expect(remainingUsers[1].id).toBe(3)
    })

    it('should work alongside .all() method', async () => {
      const query = new TestUserModel().objects.limit(3)

      // Use .next() to get first element
      const firstUser = await query.next()
      expect(firstUser?.id).toBe(1)

      // Reset and use .all()
      query.resetIterator()
      const allUsers = await query.all()

      expect(allUsers.length).toBe(3)
      expect(allUsers[0].id).toBe(1)
      expect(allUsers[1].id).toBe(2)
      expect(allUsers[2].id).toBe(3)
    })

    it('should handle empty result sets', async () => {
      const query = new TestUserModel().objects.filter({ id: 999 })

      const result = await query.next()
      expect(result).toBeUndefined()

      // Reset and try again
      query.resetIterator()
      const result2 = await query.next()
      expect(result2).toBeUndefined()
    })
  })
})
