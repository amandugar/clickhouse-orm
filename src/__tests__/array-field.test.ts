import {
  Model,
  StringField,
  NumberField,
  ArrayField,
  TupleField,
} from '../models'
import { FieldsOf, TableDefinition } from '../models/types/table-definition'
import { MigrationRunner } from '../services/MigrationRunner'
import { ConnectionManager } from '../utils/database/connection-manager'
import { TupleValue } from '../models/fields/field-types'
import { Engine } from '../utils/engines/engines'

interface TupleWithArrayValue extends Record<string, TupleValue> {
  name: string
  values: number[]
}

interface TestModelFields extends Record<string, unknown> {
  id: number
  tags: string[]
  numbers: number[]
  nested: string[][]
  tupleWithArray: TupleWithArrayValue
}

describe('ArrayField', () => {
  it('should handle basic array fields with defaults', () => {
    class TestModel extends Model<TestModelFields> {
      static fields = {
        id: new NumberField({}),
        tags: new ArrayField({
          elementType: new StringField({ defaultValue: '' }),
          defaultValue: ['tag1', 'tag2'],
        }),
        numbers: new ArrayField({
          elementType: new NumberField({ defaultValue: 0 }),
          defaultValue: [1, 2, 3],
        }),
        nested: new ArrayField({
          elementType: new ArrayField({
            elementType: new StringField({ defaultValue: '' }),
            defaultValue: [],
          }),
          defaultValue: [],
        }),
        tupleWithArray: new TupleField<TupleWithArrayValue>({
          fields: {
            name: new StringField({ defaultValue: '' }),
            values: new ArrayField({
              elementType: new NumberField({ defaultValue: 0 }),
              defaultValue: [],
            }),
          },
        }),
      }

      static tableDefinition: TableDefinition<TestModelFields> = {
        tableName: 'test_table',
        engine: Engine.MERGE_TREE,
        orderBy: ['id'],
      }
    }

    TestModel.init()
    const schema = TestModel.generateSchema()
    expect(schema.columns).toEqual([
      {
        name: 'id',
        type: 'Int32',
        expression: undefined,
        default: undefined,
      },
      {
        name: 'tags',
        type: 'Array(String)',
        expression: undefined,
        default: "['tag1', 'tag2']",
      },
      {
        name: 'numbers',
        type: 'Array(Int32)',
        expression: undefined,
        default: '[1, 2, 3]',
      },
      {
        name: 'nested',
        type: 'Array(Array(String))',
        expression: undefined,
        default: '[]',
      },
      {
        name: 'tupleWithArray',
        type: 'Tuple(name String, values Array(Int32))',
        expression: undefined,
        default: "('', [])",
      },
    ])
  })

  it('should handle nested array fields', () => {
    class NestedArrayModel extends Model<TestModelFields> {
      static fields = {
        id: new NumberField({}),
        tags: new ArrayField({
          elementType: new StringField({ defaultValue: '' }),
          defaultValue: [],
        }),
        numbers: new ArrayField({
          elementType: new NumberField({ defaultValue: 0 }),
          defaultValue: [],
        }),
        nested: new ArrayField({
          elementType: new ArrayField({
            elementType: new StringField({ defaultValue: '' }),
            defaultValue: [''],
          }),
          defaultValue: [
            ['a', 'b'],
            ['c', 'd'],
          ],
        }),
        tupleWithArray: new TupleField<TupleWithArrayValue>({
          fields: {
            name: new StringField({ defaultValue: '' }),
            values: new ArrayField({
              elementType: new NumberField({ defaultValue: 0 }),
              defaultValue: [],
            }),
          },
        }),
      }

      static tableDefinition: TableDefinition<TestModelFields> = {
        tableName: 'nested_array_table',
        engine: Engine.MERGE_TREE,
        orderBy: ['id'],
      }
    }

    NestedArrayModel.init()
    const schema = NestedArrayModel.generateSchema()
    expect(schema.columns).toEqual([
      {
        name: 'id',
        type: 'Int32',
        expression: undefined,
        default: undefined,
      },
      {
        name: 'tags',
        type: 'Array(String)',
        expression: undefined,
        default: '[]',
      },
      {
        name: 'numbers',
        type: 'Array(Int32)',
        expression: undefined,
        default: '[]',
      },
      {
        name: 'nested',
        type: 'Array(Array(String))',
        expression: undefined,
        default: "[['a', 'b'], ['c', 'd']]",
      },
      {
        name: 'tupleWithArray',
        type: 'Tuple(name String, values Array(Int32))',
        expression: undefined,
        default: "('', [])",
      },
    ])
  })

  it('should handle tuple with array field', () => {
    class TupleWithArrayModel extends Model<TestModelFields> {
      static fields = {
        id: new NumberField({}),
        tags: new ArrayField({
          elementType: new StringField({ defaultValue: '' }),
          defaultValue: [],
        }),
        numbers: new ArrayField({
          elementType: new NumberField({ defaultValue: 0 }),
          defaultValue: [],
        }),
        nested: new ArrayField({
          elementType: new ArrayField({
            elementType: new StringField({ defaultValue: '' }),
            defaultValue: [],
          }),
          defaultValue: [],
        }),
        tupleWithArray: new TupleField<TupleWithArrayValue>({
          fields: {
            name: new StringField({ defaultValue: '' }),
            values: new ArrayField({
              elementType: new NumberField({ defaultValue: 0 }),
              defaultValue: [1, 2, 3],
            }),
          },
        }),
      }

      static tableDefinition: TableDefinition<TestModelFields> = {
        tableName: 'tuple_with_array_table',
        engine: Engine.MERGE_TREE,
        orderBy: ['id'],
      }
    }

    TupleWithArrayModel.init()
    const schema = TupleWithArrayModel.generateSchema()
    expect(schema.columns).toEqual([
      {
        name: 'id',
        type: 'Int32',
        expression: undefined,
        default: undefined,
      },
      {
        name: 'tags',
        type: 'Array(String)',
        expression: undefined,
        default: '[]',
      },
      {
        name: 'numbers',
        type: 'Array(Int32)',
        expression: undefined,
        default: '[]',
      },
      {
        name: 'nested',
        type: 'Array(Array(String))',
        expression: undefined,
        default: '[]',
      },
      {
        name: 'tupleWithArray',
        type: 'Tuple(name String, values Array(Int32))',
        expression: undefined,
        default: "('', [1, 2, 3])",
      },
    ])
  })

  it('should create and delete a real table with array fields', async () => {
    class RealArrayModel extends Model<TestModelFields> {
      static fields: FieldsOf<TestModelFields> = {
        id: new NumberField({
          defaultValue: 1,
        }),
        tags: new ArrayField({
          elementType: new StringField({
            defaultValue: '',
          }),
          defaultValue: ['default', 'tag'],
        }),
        numbers: new ArrayField({
          elementType: new NumberField({
            defaultValue: 0,
          }),
          defaultValue: [1, 2, 3],
        }),
        nested: new ArrayField({
          elementType: new ArrayField({
            elementType: new StringField({
              defaultValue: '',
            }),
            defaultValue: [''],
          }),
          defaultValue: [
            ['a', 'b'],
            ['c', 'd'],
          ],
        }),
        tupleWithArray: new TupleField<TupleWithArrayValue>({
          fields: {
            name: new StringField({
              defaultValue: '',
            }),
            values: new ArrayField({
              elementType: new NumberField({
                defaultValue: 0,
              }),
              defaultValue: [],
            }),
          },
        }),
      }

      static tableDefinition: TableDefinition<TestModelFields> = {
        tableName: 'real_array_test',
        engine: Engine.MERGE_TREE,
        orderBy: ['id'],
      }
    }

    // Initialize the model
    RealArrayModel.init()

    // Create an instance of MigrationRunner
    const runner = new MigrationRunner({
      url: 'http://localhost:8123',
      username: 'default',
      database: 'test',
      password: '',
    })

    try {
      // Create the table
      ConnectionManager.setDefault({
        credentials: {
          url: 'http://localhost:8123',
          username: 'default',
          database: 'test',
          password: '',
        },
      })
      // DROP TABLE IF EXISTS real_array_test
      await runner.dropTable('real_array_test')
      const schema = RealArrayModel.generateSchema()
      await runner.createTable(schema)

      // Create a new instance and save it
      const model = new RealArrayModel()
      const instance = model.create({
        id: 1,
        tags: ['test', 'array'],
        numbers: [4, 5, 6],
        nested: [
          ['x', 'y'],
          ['z', 'w'],
        ],
      })

      await instance.save()

      // Query the saved instance
      const query = model.objects.filter({ id: 1 })
      let found = false
      for await (const row of query) {
        found = true
        expect(row.id).toBe(1)
        expect(row.tags).toEqual(['test', 'array'])
        expect(row.numbers).toEqual([4, 5, 6])
        expect(row.nested).toEqual([
          ['x', 'y'],
          ['z', 'w'],
        ])
      }
      expect(found).toBe(true)
    } finally {
      // Clean up - drop the table
      await runner.dropTable('real_array_test')
    }
  })

  it('should create and delete a real table with tuple containing array', async () => {
    class RealTupleWithArrayModel extends Model<TestModelFields> {
      static fields: FieldsOf<TestModelFields> = {
        id: new NumberField({
          defaultValue: 1,
        }),
        tags: new ArrayField({
          elementType: new StringField({ defaultValue: '' }),
          defaultValue: [],
        }),
        numbers: new ArrayField({
          elementType: new NumberField({ defaultValue: 0 }),
          defaultValue: [],
        }),
        nested: new ArrayField({
          elementType: new ArrayField({
            elementType: new StringField({ defaultValue: '' }),
            defaultValue: [],
          }),
          defaultValue: [],
        }),
        tupleWithArray: new TupleField<TupleWithArrayValue>({
          fields: {
            name: new StringField({
              defaultValue: '',
            }),
            values: new ArrayField({
              elementType: new NumberField({
                defaultValue: 0,
              }),
              defaultValue: [1, 2, 3],
            }),
          },
        }),
      }

      static tableDefinition: TableDefinition<TestModelFields> = {
        tableName: 'real_tuple_with_array_test',
        engine: Engine.MERGE_TREE,
        orderBy: ['id'],
      }
    }

    // Initialize the model
    RealTupleWithArrayModel.init()

    // Create an instance of MigrationRunner
    const runner = new MigrationRunner({
      url: 'http://localhost:8123',
      username: 'default',
      database: 'test',
      password: '',
    })

    try {
      // Create the table
      ConnectionManager.setDefault({
        credentials: {
          url: 'http://localhost:8123',
          username: 'default',
          database: 'test',
          password: '',
        },
      })
      await runner.dropTable('real_tuple_with_array_test')
      const schema = RealTupleWithArrayModel.generateSchema()
      await runner.createTable(schema)

      // Create a new instance and save it
      const model = new RealTupleWithArrayModel()
      const instance = model.create({
        id: 1,
        tupleWithArray: {
          name: 'test',
          values: [4, 5, 6],
        },
      })

      await instance.save()

      // Query the saved instance
      const query = model.objects.filter({ id: 1 })
      let found = false
      for await (const row of query) {
        found = true
        expect(row.id).toBe(1)
        expect(row.tupleWithArray.name).toBe('test')
        expect(row.tupleWithArray.values).toEqual([4, 5, 6])
      }
      expect(found).toBe(true)
    } finally {
      // Clean up - drop the table
      await runner.dropTable('real_tuple_with_array_test')
    }
  })
})
