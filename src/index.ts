import {
  BaseColumn,
  ClickhouseTable,
  Column,
  MaterializedColumn,
} from "./@types"

const generateColumnDefinition = <T extends Record<string, unknown>>(
  column: Column<T>
) => {
  const columnName = column.name
  return `${columnName} ${column.type}${
    column.default ? ` DEFAULT ${column.default.toString()}` : ""
  }`
}

const generateMaterializedColumnDefinition = <
  T extends Record<string, unknown>
>(
  column: MaterializedColumn<T>
) => {
  const columnName = column.name
  return `${columnName} ${column.type} MATERIALIZED ${column.expression}${
    column.default ? ` DEFAULT ${column.default.toString()}` : ""
  }`
}

const assertDuplicateColumns = <T extends Record<string, unknown>>(
  columns: BaseColumn<T>[]
) => {
  const columnNames = columns.map((column: BaseColumn<T>) => column.name)
  const uniqueColumnNames = new Set(columnNames)
  if (columnNames.length !== uniqueColumnNames.size) {
    throw new Error("Duplicate columns")
  }
}

const assertDuplicateMaterializedColumns = <
  T extends Record<string, unknown>,
  M extends Record<string, unknown>
>(
  columns: BaseColumn<T>[],
  materializedColumns: BaseColumn<M>[]
) => {
  // duplicate columns in materialized columns and columns
  const columnNames = [...columns, ...materializedColumns].map(
    (column: BaseColumn<T> | BaseColumn<M>) => column.name
  )
  const uniqueColumnNames = new Set(columnNames)
  if (columnNames.length !== uniqueColumnNames.size) {
    throw new Error("Duplicate columns")
  }
}

const assertPartitionKeyId = <T extends Record<string, unknown>>(
  columns: BaseColumn[],
  partitionKey: string
) => {
  for (const key of columns) {
    if (partitionKey.includes(key.name)) {
      return
    }
  }
  throw new Error("Partition key id should contain any one of column names")
}

export const parseTableToSQLString = <
  T extends Record<string, unknown>,
  M extends Record<string, unknown> = Record<string, unknown>
>(
  table: ClickhouseTable<T, M>
) => {
  if (table.columns.length === 0 || table.materializedColumns?.length === 0) {
    throw new Error("No columns defined")
  }

  assertDuplicateColumns(table.columns)
  assertDuplicateColumns(table.materializedColumns ?? [])
  assertDuplicateMaterializedColumns<T, M>(
    table.columns,
    table.materializedColumns ?? []
  )

  const partitionKey = table.partition

  if (partitionKey) {
    assertPartitionKeyId(
      [...table.columns, ...(table.materializedColumns ?? [])],
      partitionKey
    )
  }

  const columnDefinitions = table.columns
    .map(generateColumnDefinition)
    .concat(
      table.materializedColumns?.map(generateMaterializedColumnDefinition) ?? []
    )

  let sql = `CREATE TABLE ${table.name} (`
  sql += columnDefinitions.join(", ")
  sql += `) ENGINE = ${table.engine} PARTITION BY (${table.partition}) ${
    table.primaryKeyId ? `PRIMARY KEY (${table.primaryKeyId.join(", ")})` : ""
  } ${table.orderBy ? `ORDER BY (${table.orderBy.join(", ")})` : ""}`
  return sql.trim()
}
