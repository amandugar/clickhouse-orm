import { parseTableToSQLString } from "../index"
import { Engine } from "../utils/engines"
import { Types } from "../utils/types"

describe("parseTableToSQLString", () => {
  it("should throw an error if no columns are defined", () => {
    expect(() =>
      parseTableToSQLString({
        name: "test",
        partition: "test",
        engine: Engine.MERGE_TREE,
        columns: [],
        materializedColumns: [],
      })
    ).toThrow("No columns defined")
  })

  it("should parse a table to a SQL string", () => {
    type Table = {
      id: number
      name: string
      isActive: boolean
    }

    const table = parseTableToSQLString<Table>({
      name: "test",
      partition: "name",
      engine: Engine.MERGE_TREE,
      columns: [
        { name: "id", type: Types.Number.INT_32 },
        { name: "name", type: Types.String.STRING },
        { name: "isActive", type: Types.Boolean.BOOLEAN },
      ],
    })

    expect(table).toBe(
      "CREATE TABLE test (id Int32, name String, isActive Boolean) ENGINE = MergeTree PARTITION BY (name)"
    )
  })
})
