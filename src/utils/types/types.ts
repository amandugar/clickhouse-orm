export enum NumberTypes {
  INT_8 = 'Int8',
  INT_16 = 'Int16',
  INT_32 = 'Int32',
  INT_64 = 'Int64',
  UINT_8 = 'UInt8',
  UINT_16 = 'UInt16',
  UINT_32 = 'UInt32',
  UINT_64 = 'UInt64',
}

export enum StringTypes {
  STRING = 'String',
}

export enum BooleanTypes {
  BOOLEAN = 'Boolean',
}

export const Types = {
  Number: NumberTypes,
  String: StringTypes,
  Boolean: BooleanTypes,
} as const
