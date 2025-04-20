import {
  BooleanField,
  BooleanFieldTypes,
  Model,
  NumberField,
  NumberFieldTypes,
  StringField,
  StringFieldTypes,
} from '../models'
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
    engine: 'MergeTree',
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
      "SELECT * FROM users WHERE ((id = 1 OR id = 2 OR (id = 3 AND email = 'test@test.com')))",
    )
  })

  it('should create a query builder with not', async () => {
    const user1 = new UserModel()

    const queryData = user1.objects.filter(
      new Q<User>().not(new Q<User>().or([{ id: 1 }, { id: 2 }])),
    )

    const queryRightNow = queryData.getQuery()
    expect(queryRightNow).toBe(
      'SELECT * FROM users WHERE ((NOT (id = 1 OR id = 2)))',
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
      "SELECT * FROM users WHERE (((id = 1 AND name = 'John') OR (NOT (id = 2 OR email = 'test@test.com'))))",
    )
  })
})
