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

describe("Model", () => {
  it("should create a table statement", () => {
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
      static fields: FieldsOf<User> = {
        id: new NumberField({ type: NumberFieldTypes.Int32 }),
        name: new StringField({ type: StringFieldTypes.String }),
        email: new StringField({ type: StringFieldTypes.String }),
        isActive: new BooleanField({ type: BooleanFieldTypes.Boolean }),
      }

      static materializedFields: FieldsOf<UserMaterialized> = {
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

    expect(table).toBe(
      "CREATE TABLE users (id Int32, name String, email String, isActive Boolean) ENGINE = MergeTree PARTITION BY name PRIMARY KEY (id) ORDER BY (id)"
    )
  })
})
