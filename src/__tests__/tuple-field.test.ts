import { Model, StringField, NumberField, TupleField } from '../models'
import { FieldsOf, TableDefinition } from '../models/types/table-definition'
import { NumberFieldTypes, TupleValue } from '../models/fields/field-types'
import { MigrationRunner } from '../services/MigrationRunner'
import { ConnectionManager } from '../utils/database/connection-manager'

interface AddressValue extends Record<string, TupleValue> {
  street: string
  city: string
  location: {
    lat: number
    lon: number
  }
}

interface CoordinatesValue extends Record<string, TupleValue> {
  x: {
    a: {
      e: number
      f: number
    }
    b: number
  }
  y: {
    c: {
      g: number
      h: number
    }
    d: number
  }
}

interface TestModelFields extends Record<string, unknown> {
  id: number
  address: AddressValue
}

interface SimpleTupleModelFields extends Record<string, unknown> {
  id: number
  coordinates: CoordinatesValue
}

describe('TupleField', () => {
  it('should handle nested tuples with defaults', () => {
    class TestModel extends Model<TestModelFields> {
      static fields = {
        id: new NumberField({}),
        address: new TupleField<AddressValue>({
          fields: {
            street: new StringField({ defaultValue: '' }),
            city: new StringField({ defaultValue: 'Unknown' }),
            location: new TupleField<{ lat: number; lon: number }>({
              fields: {
                lat: new NumberField({
                  defaultValue: 0.0,
                  type: NumberFieldTypes.Float64,
                }),
                lon: new NumberField({
                  defaultValue: 0.0,
                  type: NumberFieldTypes.Float64,
                }),
              },
            }),
          },
        }),
      }

      static tableDefinition: TableDefinition<TestModelFields> = {
        tableName: 'test_table',
        engine: 'MergeTree',
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
        name: 'address',
        type: 'Tuple(street String, city String, location Tuple(lat Float64, lon Float64))',
        expression: undefined,
        default: "('', 'Unknown', (0, 0))",
      },
    ])
  })

  it('should handle simple tuple with defaults', () => {
    class SimpleTupleModel extends Model<SimpleTupleModelFields> {
      static fields = {
        id: new NumberField({}),
        coordinates: new TupleField<CoordinatesValue>({
          fields: {
            x: new TupleField<{ a: number; b: number }>({
              fields: {
                a: new TupleField<{ e: number; f: number }>({
                  fields: {
                    e: new NumberField({ defaultValue: 0 }),
                    f: new NumberField({ defaultValue: 0 }),
                  },
                }),
                b: new NumberField({ defaultValue: 0 }),
              },
            }),
            y: new TupleField<{ c: number; d: number }>({
              fields: {
                c: new TupleField<{ g: number; h: number }>({
                  fields: {
                    g: new NumberField({ defaultValue: 0 }),
                    h: new NumberField({ defaultValue: 0 }),
                  },
                }),
                d: new NumberField({ defaultValue: 0 }),
              },
            }),
          },
        }),
      }

      static tableDefinition: TableDefinition<SimpleTupleModelFields> = {
        tableName: 'simple_tuple_table',
        engine: 'MergeTree',
        orderBy: ['id'],
      }
    }

    SimpleTupleModel.init()
    const schema = SimpleTupleModel.generateSchema()
    expect(schema.columns).toEqual([
      {
        name: 'id',
        type: 'Int32',
        expression: undefined,
        default: undefined,
      },
      {
        name: 'coordinates',
        type: 'Tuple(x Tuple(a Tuple(e Int32, f Int32), b Int32), y Tuple(c Tuple(g Int32, h Int32), d Int32))',
        expression: undefined,
        default: '(((0, 0), 0), ((0, 0), 0))',
      },
    ])
  })

  it('should create and delete a real table with tuple fields', async () => {
    class RealTupleModel extends Model<TestModelFields> {
      static fields: FieldsOf<TestModelFields> = {
        id: new NumberField({
          defaultValue: 1,
          type: NumberFieldTypes.Float64,
        }),
        address: new TupleField<AddressValue>({
          fields: {
            street: new StringField({
              defaultValue: 'Main St',
            }),
            city: new StringField({ defaultValue: 'Test City' }),
            location: new TupleField<{ lat: number; lon: number }>({
              fields: {
                lat: new NumberField({
                  defaultValue: 0.0,
                  type: NumberFieldTypes.Float64,
                }),
                lon: new NumberField({
                  defaultValue: 0.0,
                  type: NumberFieldTypes.Float64,
                }),
              },
            }),
          },
        }),
      }

      static tableDefinition: TableDefinition<TestModelFields> = {
        tableName: 'real_tuple_test',
        engine: 'MergeTree',
        orderBy: ['id'],
      }
    }

    // Initialize the model
    RealTupleModel.init()

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
      // DROP TABLE IF EXISTS real_tuple_test
      await runner.dropTable('real_tuple_test')
      const schema = RealTupleModel.generateSchema()
      await runner.createTable(schema)

      // Create a new instance and save it
      const model = new RealTupleModel()
      const instance = model.create({
        id: 1,
        address: {
          street: 'Test Street',
          city: 'Test City',
          location: {
            lat: 40.7128,
            lon: -74.006,
          },
        },
      })

      await instance.save()

      // Query the saved instance
      const query = model.objects.filter({ id: 1 })
      let found = false
      for await (const row of query) {
        found = true
        expect(row.id).toBe(1)
        expect(row.address.street).toBe('Test Street')
        expect(row.address.city).toBe('Test City')
      }
      expect(found).toBe(true)
    } finally {
      await runner.dropTable('real_tuple_test')
    }
  })
})
