import {
  Model,
  StringField,
  NumberField,
  BooleanField,
  TupleField,
} from '../models'
import { ConnectionManager } from '../utils'
import { credentials } from './utils'
import { Engine } from '../utils/engines/engines'
import { FieldsOf } from '../models/types/table-definition'
import {
  StringFieldTypes,
  NumberFieldTypes,
  BooleanFieldTypes,
  TupleFieldTypes,
} from '../models/fields/field-types'

// User interface with nested fields
interface User {
  id: number
  name: string
  email: string
  profile: {
    age: number
    location: {
      city: string
      country: string
    }
  }
  settings: {
    notifications: {
      email: boolean
      push: boolean
    }
    preferences: {
      theme: string
      language: string
    }
  }
  metadata: {
    createdAt: number
    lastLogin: number
  }
}

// User model with nested fields
class UserModel extends Model<User> {
  static fields: FieldsOf<User> = {
    id: new NumberField({ type: NumberFieldTypes.Int32 }),
    name: new StringField({ type: StringFieldTypes.String }),
    email: new StringField({ type: StringFieldTypes.String }),
    profile: new TupleField({
      type: TupleFieldTypes.Tuple,
      fields: {
        age: new NumberField({ type: NumberFieldTypes.Int32 }),
        location: new TupleField({
          type: TupleFieldTypes.Tuple,
          fields: {
            city: new StringField({ type: StringFieldTypes.String }),
            country: new StringField({ type: StringFieldTypes.String }),
          },
        }),
      },
    }),
    settings: new TupleField({
      type: TupleFieldTypes.Tuple,
      fields: {
        notifications: new TupleField({
          type: TupleFieldTypes.Tuple,
          fields: {
            email: new BooleanField({ type: BooleanFieldTypes.Boolean }),
            push: new BooleanField({ type: BooleanFieldTypes.Boolean }),
          },
        }),
        preferences: new TupleField({
          type: TupleFieldTypes.Tuple,
          fields: {
            theme: new StringField({ type: StringFieldTypes.String }),
            language: new StringField({ type: StringFieldTypes.String }),
          },
        }),
      },
    }),
    metadata: new TupleField({
      type: TupleFieldTypes.Tuple,
      fields: {
        createdAt: new NumberField({ type: NumberFieldTypes.Int64 }),
        lastLogin: new NumberField({ type: NumberFieldTypes.Int64 }),
      },
    }),
  }

  static tableDefinition = {
    tableName: 'users',
    engine: Engine.MERGE_TREE,
    orderBy: ['id'],
    primaryKey: ['id'],
  }
}

UserModel.init()

describe('QueryBuilder Nested Sort', () => {
  beforeAll(async () => {
    ConnectionManager.setDefault({ credentials })
    await ConnectionManager.createDatabase('test')
  })

  describe('Basic Nested Sort Tests', () => {
    it('should sort by simple nested field', () => {
      const userModel = new UserModel()
      const query = userModel.objects.sort({
        profile: {
          age: -1,
        },
      })

      expect(query.getQuery()).toBe(
        'SELECT * FROM users  ORDER BY profile.age DESC',
      )
    })

    it('should sort by nested field in ascending order', () => {
      const userModel = new UserModel()
      const query = userModel.objects.sort({
        profile: {
          age: 1,
        },
      })

      expect(query.getQuery()).toBe(
        'SELECT * FROM users  ORDER BY profile.age ASC',
      )
    })

    it('should sort by multiple nested fields', () => {
      const userModel = new UserModel()
      const query = userModel.objects.sort({
        profile: {
          age: -1,
          location: {
            city: 1,
          },
        },
        metadata: {
          createdAt: -1,
        },
      })

      expect(query.getQuery()).toBe(
        'SELECT * FROM users  ORDER BY profile.age DESC, profile.location.city ASC, metadata.createdAt DESC',
      )
    })

    it('should sort by deeply nested fields', () => {
      const userModel = new UserModel()
      const query = userModel.objects.sort({
        profile: {
          location: {
            country: -1,
          },
        },
        settings: {
          preferences: {
            language: 1,
          },
        },
      })

      expect(query.getQuery()).toBe(
        'SELECT * FROM users  ORDER BY profile.location.country DESC, settings.preferences.language ASC',
      )
    })

    it('should mix simple and nested field sorting', () => {
      const userModel = new UserModel()
      const query = userModel.objects.sort({
        id: 1,
        name: -1,
        profile: {
          age: -1,
        },
      })

      expect(query.getQuery()).toBe(
        'SELECT * FROM users  ORDER BY id ASC, name DESC, profile.age DESC',
      )
    })
  })

  describe('User Profile Specific Tests', () => {
    it('should sort by user age', () => {
      const userModel = new UserModel()
      const query = userModel.objects.sort({
        profile: {
          age: 1,
        },
      })

      expect(query.getQuery()).toBe(
        'SELECT * FROM users  ORDER BY profile.age ASC',
      )
    })

    it('should sort by user age descending', () => {
      const userModel = new UserModel()
      const query = userModel.objects.sort({
        profile: {
          age: -1,
        },
      })

      expect(query.getQuery()).toBe(
        'SELECT * FROM users  ORDER BY profile.age DESC',
      )
    })

    it('should sort by multiple profile fields', () => {
      const userModel = new UserModel()
      const query = userModel.objects.sort({
        profile: {
          age: -1,
          location: {
            city: 1,
            country: -1,
          },
        },
      })

      expect(query.getQuery()).toBe(
        'SELECT * FROM users  ORDER BY profile.age DESC, profile.location.city ASC, profile.location.country DESC',
      )
    })

    it('should sort by user settings', () => {
      const userModel = new UserModel()
      const query = userModel.objects.sort({
        settings: {
          preferences: {
            theme: 1,
            language: -1,
          },
        },
      })

      expect(query.getQuery()).toBe(
        'SELECT * FROM users  ORDER BY settings.preferences.theme ASC, settings.preferences.language DESC',
      )
    })

    it('should sort by deeply nested user settings', () => {
      const userModel = new UserModel()
      const query = userModel.objects.sort({
        settings: {
          notifications: {
            email: 1,
          },
          preferences: {
            theme: -1,
          },
        },
      })

      expect(query.getQuery()).toBe(
        'SELECT * FROM users  ORDER BY settings.notifications.email ASC, settings.preferences.theme DESC',
      )
    })

    it('should handle complex user sorting with multiple nested levels', () => {
      const userModel = new UserModel()
      const query = userModel.objects.sort({
        id: 1,
        profile: {
          age: -1,
        },
        metadata: {
          createdAt: -1,
        },
        settings: {
          preferences: {
            language: 1,
          },
        },
      })

      expect(query.getQuery()).toBe(
        'SELECT * FROM users  ORDER BY id ASC, profile.age DESC, metadata.createdAt DESC, settings.preferences.language ASC',
      )
    })
  })

  describe('Query Chaining Tests', () => {
    it('should chain sort with filter', () => {
      const userModel = new UserModel()
      const query = userModel.objects.filter({ name: 'John' }).sort({
        profile: {
          age: -1,
        },
      })

      expect(query.getQuery()).toBe(
        "SELECT * FROM users WHERE (name = 'John') ORDER BY profile.age DESC",
      )
    })

    it('should chain sort with limit and offset', () => {
      const userModel = new UserModel()
      const query = userModel.objects
        .sort({
          profile: {
            age: -1,
          },
        })
        .limit(10)
        .offset(5)

      expect(query.getQuery()).toBe(
        'SELECT * FROM users  ORDER BY profile.age DESC LIMIT 10 OFFSET 5',
      )
    })

    it('should chain sort with project', () => {
      const userModel = new UserModel()
      const query = userModel.objects.project(['id', 'name']).sort({
        profile: {
          age: -1,
        },
      })

      expect(query.getQuery()).toBe(
        'SELECT id, name FROM users  ORDER BY profile.age DESC',
      )
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty sort object', () => {
      const userModel = new UserModel()
      const query = userModel.objects.sort({})
      expect(query.getQuery()).toBe('SELECT * FROM users ')
    })

    it('should handle sort with only simple fields', () => {
      const userModel = new UserModel()
      const query = userModel.objects.sort({
        id: 1,
        name: -1,
      })

      expect(query.getQuery()).toBe(
        'SELECT * FROM users  ORDER BY id ASC, name DESC',
      )
    })

    it('should handle sort with only nested fields', () => {
      const userModel = new UserModel()
      const query = userModel.objects.sort({
        profile: {
          age: -1,
        },
      })

      expect(query.getQuery()).toBe(
        'SELECT * FROM users  ORDER BY profile.age DESC',
      )
    })

    it('should handle multiple sort calls (should override previous)', () => {
      const userModel = new UserModel()
      const query = userModel.objects
        .sort({
          id: 1,
        })
        .sort({
          profile: {
            age: -1,
          },
        })

      expect(query.getQuery()).toBe(
        'SELECT * FROM users  ORDER BY id ASC, profile.age DESC',
      )
    })
  })

  describe('Deep Nesting Tests', () => {
    it('should handle 3-level deep nesting', () => {
      const userModel = new UserModel()
      const query = userModel.objects.sort({
        settings: {
          preferences: {
            language: -1,
          },
        },
      })

      expect(query.getQuery()).toBe(
        'SELECT * FROM users  ORDER BY settings.preferences.language DESC',
      )
    })

    it('should handle 4-level deep nesting', () => {
      const userModel = new UserModel()
      const query = userModel.objects.sort({
        profile: {
          location: {
            city: 1,
          },
        },
      })

      expect(query.getQuery()).toBe(
        'SELECT * FROM users  ORDER BY profile.location.city ASC',
      )
    })
  })

  describe('Integration Tests', () => {
    it('should work with complex query building', () => {
      const userModel = new UserModel()
      const query = userModel.objects
        .filter({
          name: 'John',
          email: 'john@example.com',
        })
        .exclude({
          profile: {
            age: 0,
            location: {
              city: '',
              country: '',
            },
          },
        })
        .sort({
          profile: {
            age: -1,
          },
          metadata: {
            createdAt: -1,
          },
        })
        .limit(100)
        .offset(0)

      expect(query.getQuery()).toBe(
        "SELECT * FROM users WHERE ((name = 'John') AND (email = 'john@example.com') AND (profile != [object Object])) ORDER BY profile.age DESC, metadata.createdAt DESC LIMIT 100",
      )
    })
  })
})
