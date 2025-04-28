import { Model } from '../model'
import { NumberField, StringField } from '../fields'
import { Sum, Avg, Count, Min, Max } from '../aggregation'
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

describe('Aggregation', () => {
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

  it('should perform basic aggregations', async () => {
    const sale = new Sale()
    const result = await sale.objects
      .filter(new Q<SaleFields>().and([{ price__gt: 100 }]))
      .aggregate({
        total_revenue: new Sum('price', 'total_revenue'),
        avg_price: new Avg('price', 'avg_price'),
        total_sales: new Count('*', 'total_sales'),
        min_price: new Min('price', 'min_price'),
        max_price: new Max('price', 'max_price'),
      })
      .all()

    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
    expect(result[0]).toHaveProperty('total_revenue')
    expect(result[0]).toHaveProperty('avg_price')
    expect(result[0]).toHaveProperty('total_sales')
    expect(result[0]).toHaveProperty('min_price')
    expect(result[0]).toHaveProperty('max_price')
  })

  it('should handle aliased aggregations', async () => {
    const sale = new Sale()
    const result = await sale.objects
      .filter(
        new Q<{
          id: number
          price: number
          quantity: number
          date: string
        }>().and([{ price__gt: 100 }]),
      )
      .aggregate({
        total: new Sum('price', 'total_amount'),
        average: new Avg('price', 'mean_price'),
      })
      .all()

    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
    expect(result[0]).toHaveProperty('total_amount')
    expect(result[0]).toHaveProperty('mean_price')
  })

  it('should work with filters', async () => {
    const sale = new Sale()
    const query = sale.objects
      .filter(
        new Q<{
          id: number
          price: number
          quantity: number
          date: string
        }>().and([{ price__gt: 100 }, { quantity__gt: 1 }]),
      )
      .aggregate({
        total_revenue: new Sum('price', 'total_revenue'),
        total_quantity: new Sum('quantity', 'total_quantity'),
      })
      .getQuery()

    expect(query).toContain(
      'SELECT SUM(price) as total_revenue, SUM(quantity) as total_quantity FROM sales',
    )
    expect(query).toContain('WHERE (((price > 100)) AND ((quantity > 1)))')
  })
})
