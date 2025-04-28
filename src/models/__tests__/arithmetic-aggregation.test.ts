import { Model } from '../model'
import { NumberField, StringField } from '../fields'
import { Sum, add, subtract, multiply, divide } from '../aggregation'
import { Engine } from '../../utils/engines/engines'
import { FieldsOf, TableDefinition } from '../types/table-definition'
import { NumberFieldTypes } from '../fields/field-types'
import { Q } from '../query-builder'
import { ConnectionCredentials, ConnectionManager } from '../../utils'

type SaleFields = {
  id: number
  price: number
  quantity: number
  date: string
}

const connectionConfig: ConnectionCredentials = {
  url: 'http://localhost:8123',
  username: 'default',
  password: '',
  database: 'default',
}

// Test model
class Sale extends Model<SaleFields> {
  static fields: FieldsOf<SaleFields> = {
    id: new NumberField({ type: NumberFieldTypes.Int32 }),
    price: new NumberField({ type: NumberFieldTypes.Float32 }),
    quantity: new NumberField({ type: NumberFieldTypes.Int32 }),
    date: new StringField({}),
  }

  static tableDefinition: TableDefinition<SaleFields> = {
    tableName: 'sales',
    engine: Engine.MERGE_TREE,
    orderBy: ['id'],
  }
}

describe('Arithmetic Aggregation', () => {
  beforeAll(async () => {
    ConnectionManager.setDefault({
      credentials: connectionConfig,
    })
    ConnectionManager.createDatabase('default')
    Sale.init()

    // Insert some test data
    const sale = new Sale()
    await sale
      .create({
        id: 1,
        price: 150,
        quantity: 2,
        date: '2024-01-01',
      })
      .save()

    await sale
      .create({
        id: 2,
        price: 200,
        quantity: 3,
        date: '2024-01-02',
      })
      .save()
  })

  afterEach(async () => {
    await ConnectionManager.closeAll()
  })

  afterAll(async () => {
    await ConnectionManager.closeAll()
  })

  it('should perform addition in aggregations', async () => {
    const sale = new Sale()
    const result = await sale.objects
      .filter(new Q<SaleFields>().and([{ price__gt: 100 }]))
      .aggregate({
        total_revenue: new Sum('price', 'total_revenue'),
        total_quantity: new Sum('quantity', 'total_quantity'),
        total_with_addition: add(
          new Sum('price', 'total_revenue'),
          new Sum('quantity', 'total_quantity'),
        ),
      })
      .all()

    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
    expect(result[0]).toHaveProperty('total_revenue')
    expect(result[0]).toHaveProperty('total_quantity')
    expect(result[0]).toHaveProperty('total_with_addition')
  })

  it('should perform subtraction in aggregations', async () => {
    const sale = new Sale()
    const result = await sale.objects
      .filter(new Q<SaleFields>().and([{ price__gt: 100 }]))
      .aggregate({
        total_revenue: new Sum('price', 'total_revenue'),
        total_quantity: new Sum('quantity', 'total_quantity'),
        revenue_minus_quantity: subtract(
          new Sum('price', 'total_revenue'),
          new Sum('quantity', 'total_quantity'),
        ),
      })
      .all()

    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
    expect(result[0]).toHaveProperty('total_revenue')
    expect(result[0]).toHaveProperty('total_quantity')
    expect(result[0]).toHaveProperty('revenue_minus_quantity')
  })

  it('should perform multiplication in aggregations', async () => {
    const sale = new Sale()
    const result = await sale.objects
      .filter(new Q<SaleFields>().and([{ price__gt: 100 }]))
      .aggregate({
        total_revenue: new Sum('price', 'total_revenue'),
        total_quantity: new Sum('quantity', 'total_quantity'),
        revenue_times_quantity: multiply(
          new Sum('price', 'total_revenue'),
          new Sum('quantity', 'total_quantity'),
        ),
      })
      .all()

    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
    expect(result[0]).toHaveProperty('total_revenue')
    expect(result[0]).toHaveProperty('total_quantity')
    expect(result[0]).toHaveProperty('revenue_times_quantity')
  })

  it('should perform division in aggregations', async () => {
    const sale = new Sale()
    const result = await sale.objects
      .filter(new Q<SaleFields>().and([{ price__gt: 100 }]))
      .aggregate({
        total_revenue: new Sum('price', 'total_revenue'),
        total_quantity: new Sum('quantity', 'total_quantity'),
        average_price_per_quantity: divide(
          new Sum('price', 'total_revenue'),
          new Sum('quantity', 'total_quantity'),
        ),
      })
      .all()

    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
    expect(result[0]).toHaveProperty('total_revenue')
    expect(result[0]).toHaveProperty('total_quantity')
    expect(result[0]).toHaveProperty('average_price_per_quantity')
  })

  it('should handle complex arithmetic expressions', async () => {
    const sale = new Sale()
    const result = await sale.objects
      .filter(new Q<SaleFields>().and([{ price__gt: 100 }]))
      .aggregate({
        total_revenue: new Sum('price', 'total_revenue'),
        total_quantity: new Sum('quantity', 'total_quantity'),
        complex_calculation: add(
          multiply(
            new Sum('price', 'total_revenue'),
            new Sum('quantity', 'total_quantity'),
          ),
          divide(
            new Sum('price', 'total_revenue'),
            new Sum('quantity', 'total_quantity'),
          ),
        ),
      })
      .all()

    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
    expect(result[0]).toHaveProperty('total_revenue')
    expect(result[0]).toHaveProperty('total_quantity')
    expect(result[0]).toHaveProperty('complex_calculation')
  })

  it('should generate correct SQL for arithmetic operations', async () => {
    const sale = new Sale()
    const query = sale.objects
      .filter(new Q<SaleFields>().and([{ price__gt: 100 }]))
      .aggregate({
        complex_calculation: add(
          multiply(
            new Sum('price', 'total_revenue'),
            new Sum('quantity', 'total_quantity'),
          ),
          divide(
            new Sum('price', 'total_revenue'),
            new Sum('quantity', 'total_quantity'),
          ),
        ),
      })
      .getQuery()

    expect(query).toContain(
      'SELECT ((SUM(price) * SUM(quantity)) + (SUM(price) / SUM(quantity))) as complex_calculation FROM sales',
    )
    expect(query).toContain('WHERE ((price > 100))')
  })
})
