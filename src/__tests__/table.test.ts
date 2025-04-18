import {
  BooleanField,
  BooleanFieldTypes,
  FieldsOf,
  MergeTreeTableDefinition,
  Model,
  NumberField,
  NumberFieldTypes,
  StringField,
  StringFieldTypes,
} from "../migrations/model"

describe("Model", () => {
  it("should create a table statement", () => {
    type User = {
      id: number
      name: string
      email: string
      isActive: boolean
    }

    class UserModel extends Model<User> {
      static fields: FieldsOf<User> = {
        id: new NumberField({ type: NumberFieldTypes.Int32 }),
        name: new StringField({ type: StringFieldTypes.String }),
        email: new StringField({ type: StringFieldTypes.String }),
        isActive: new BooleanField({ type: BooleanFieldTypes.Boolean }),
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
