import { StringField } from '../string-field'
import { StringFieldTypes } from '../field-types'

describe('StringField', () => {
  describe('enum types', () => {
    it('should create Enum8 type with numeric values', () => {
      const field = new StringField({
        type: StringFieldTypes.Enum8,
        enumValues: {
          '': 0,
          ACH: 1,
          CARD: 2,
          IBAN: 3,
        },
      })

      expect(field.getType()).toBe(
        "Enum8('' = 0, 'ACH' = 1, 'CARD' = 2, 'IBAN' = 3)",
      )
    })

    it('should create Enum16 type with numeric values', () => {
      const field = new StringField({
        type: StringFieldTypes.Enum16,
        enumValues: {
          '': 0,
          ACH: 1,
          CARD: 2,
          IBAN: 3,
        },
      })

      expect(field.getType()).toBe(
        "Enum16('' = 0, 'ACH' = 1, 'CARD' = 2, 'IBAN' = 3)",
      )
    })

    it('should throw error when enum values are not provided', () => {
      const field = new StringField({
        type: StringFieldTypes.Enum8,
      })

      expect(() => field.getType()).toThrow(
        'Enum values are required for Enum type',
      )
    })

    it('should throw error when enum values are empty', () => {
      const field = new StringField({
        type: StringFieldTypes.Enum8,
        enumValues: {},
      })

      expect(() => field.getType()).toThrow(
        'Enum values are required for Enum type',
      )
    })

    it('should handle special characters in enum values', () => {
      const field = new StringField({
        type: StringFieldTypes.Enum8,
        enumValues: {
          SPECIAL_CHAR: 1,
          WITH_SPACE: 2,
          "WITH_QUOTE'S": 3,
        },
      })

      expect(field.getType()).toBe(
        "Enum8('SPECIAL_CHAR' = 1, 'WITH_SPACE' = 2, 'WITH_QUOTE\\'S' = 3)",
      )
    })

    it('should maintain numeric order of enum values', () => {
      const field = new StringField({
        type: StringFieldTypes.Enum8,
        enumValues: {
          C: 3,
          A: 1,
          B: 2,
        },
      })

      expect(field.getType()).toBe("Enum8('A' = 1, 'B' = 2, 'C' = 3)")
    })
  })

  describe('default string type', () => {
    it('should create default String type when no type specified', () => {
      const field = new StringField({})
      expect(field.getType()).toBe(StringFieldTypes.String)
    })

    it('should create String type when explicitly specified', () => {
      const field = new StringField({
        type: StringFieldTypes.String,
      })
      expect(field.getType()).toBe(StringFieldTypes.String)
    })
  })
})
