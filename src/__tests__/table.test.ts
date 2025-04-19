import {
  BooleanField,
  BooleanFieldTypes,
  Model,
  NumberField,
  NumberFieldTypes,
  StringField,
  StringFieldTypes,
} from "../models"
import {
  FieldsOf,
  MergeTreeTableDefinition,
} from "../models/definitions/table-definition"
import { ConnectionManager } from "../utils/connection-manager"

describe("Model", () => {
  it("should create a table statement", async () => {
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
        engine: "MergeTree",
        partitionBy: "name",
        orderBy: ["id"],
        tableName: "users",
        primaryKey: ["id"],
      }
    }

    UserModel.init()

    const table = UserModel.createTableStatement()
    ConnectionManager.setDefault({
      credentials: {
        url: "http://localhost:8123",
        username: "default",
        database: "default",
      },
    })
    ConnectionManager.createDatabase("test")
    ConnectionManager.setDefault({
      credentials: {
        url: "http://localhost:8123",
        username: "default",
        database: "test",
      },
    })
    UserModel.createTable()
    UserModel.init()
    const user = new UserModel().create({
      email: "test@test.com",
      name: "Test",
      id: 1,
      isActive: true,
    })

    await user.save()

    expect(table).toBe(
      "CREATE TABLE IF NOT EXISTS users (id Int32, name String, email String, isActive Boolean, userName String MATERIALIZED concat(name, ' ', email)) ENGINE = MergeTree PARTITION BY name PRIMARY KEY (id) ORDER BY (id)"
    )
  })
})
