import {
  BooleanField,
  Model,
  NumberField,
  StringField,
  TupleField,
} from '../models'
import { FieldsOf, TableDefinition } from '../models/types/table-definition'
import { Q } from '../models/query-builder'
import { FieldOperators, OperatorSuffix } from '../models/operators'

type Name = {
  first?: string
  last?: string
}

type Contact = {
  email?: string
  phone: string
}

type Address = {
  street: string
  city?: string
  country?: string
}
type UserProfile = {
  name?: Name
  contact?: Contact
  address?: Address
}

type User = {
  id: number
  profile: UserProfile
  isActive: boolean
}

class UserModel extends Model<User> {
  static fields = {
    id: new NumberField({}),
    profile: new TupleField<UserProfile>({
      fields: {
        name: new TupleField<Name>({
          fields: {
            first: new StringField({}),
            last: new StringField({}),
          },
        }),
        contact: new TupleField<Contact>({
          fields: {
            email: new StringField({}),
            phone: new StringField({}),
          },
        }),
        address: new TupleField<Address>({
          fields: {
            street: new StringField({}),
            city: new StringField({}),
            country: new StringField({}),
          },
        }),
      },
    }),
    isActive: new BooleanField({}),
  }

  static tableDefinition: TableDefinition<User> = {
    tableName: 'users',
    engine: 'MergeTree',
    orderBy: ['id'],
  }
}

describe('Nested Object Query', () => {
  let userModel: UserModel

  beforeEach(() => {
    userModel = new UserModel()
  })

  it('should handle simple nested object queries', () => {
    const query = userModel.objects.filter({
      profile: {
        name: {
          first: 'Aman',
        },
      },
    })

    expect(query.getQuery()).toBe(
      "SELECT * FROM users WHERE (profile.name.first = 'Aman')",
    )
  })

  it('should handle multiple nested conditions', () => {
    const query = userModel.objects.filter({
      profile: {
        name: {
          first: 'Aman',
          last: 'Dugar',
        },
        contact: {
          email: 'aman@example.com',
          phone: '1234567890',
        },
      },
    })

    expect(query.getQuery()).toBe(
      "SELECT * FROM users WHERE ((profile.name.first = 'Aman') AND (profile.name.last = 'Dugar') AND (profile.contact.email = 'aman@example.com') AND (profile.contact.phone = '1234567890'))",
    )
  })

  it('should handle nested objects with operators', () => {
    const query = userModel.objects.filter({
      profile: {
        name: {
          first__icontains: 'Aman',
        },
        contact: {
          email__in: ['aman@example.com', 'test@example.com'],
        },
      },
    })

    expect(query.getQuery()).toBe(
      "SELECT * FROM users WHERE ((profile.name.first LIKE '%Aman%') AND (profile.contact.email IN ('aman@example.com', 'test@example.com')))",
    )
  })

  it('should handle nested objects with Q class', () => {
    const query = userModel.objects.filter(
      new Q<User>().and([
        {
          profile: {
            name: {
              first: 'Aman',
              last: 'Dugar',
            },
          },
        },
        {
          profile: {
            contact: {
              email: 'aman@example.com',
              phone: '1234567890',
            },
          },
        },
      ]),
    )

    expect(query.getQuery()).toBe(
      "SELECT * FROM users WHERE (((((profile.name.first = 'Aman') AND (profile.name.last = 'Dugar')))) AND ((((profile.contact.email = 'aman@example.com') AND (profile.contact.phone = '1234567890')))))",
    )
  })

  it('should handle nested objects with OR conditions', () => {
    const query = userModel.objects.filter(
      new Q<User>().or([
        {
          profile: {
            name: {
              first: 'Aman',
              last: 'Dugar',
            },
          },
        },
        {
          profile: {
            contact: {
              email: 'test@example.com',
              phone: '1234567890',
            },
          },
        },
      ]),
    )

    expect(query.getQuery()).toBe(
      "SELECT * FROM users WHERE (((((profile.name.first = 'Aman') AND (profile.name.last = 'Dugar')))) OR ((((profile.contact.email = 'test@example.com') AND (profile.contact.phone = '1234567890')))))",
    )
  })

  it('should handle nested objects with NOT conditions', () => {
    const query = userModel.objects.filter(
      new Q<User>().not({
        profile: {
          name: {
            first: 'Aman',
            last: 'Dugar',
          },
        },
      }),
    )

    expect(query.getQuery()).toBe(
      "SELECT * FROM users WHERE (NOT ((((profile.name.first = 'Aman') AND (profile.name.last = 'Dugar')))))",
    )
  })

  it('should handle complex nested conditions', () => {
    const query = userModel.objects.filter(
      new Q<User>().and([
        {
          profile: {
            name: {
              first: 'Aman',
              last: 'Dugar',
            },
          },
        },
        new Q<User>().or([
          {
            profile: {
              contact: {
                email: 'aman@example.com',
                phone: '1234567890',
              },
            },
          },
          {
            profile: {
              address: {
                city: 'New York',
                street: '123 Main St',
                country: 'USA',
              },
            },
          },
        ]),
      ]),
    )

    expect(query.getQuery()).toBe(
      "SELECT * FROM users WHERE (((((profile.name.first = 'Aman') AND (profile.name.last = 'Dugar')))) AND (((((profile.contact.email = 'aman@example.com') AND (profile.contact.phone = '1234567890')))) OR ((((profile.address.city = 'New York') AND (profile.address.street = '123 Main St') AND (profile.address.country = 'USA'))))))",
    )
  })

  it('should handle complex nested conditions with operators', () => {
    const query = userModel.objects.filter(
      new Q<User>().and([
        {
          profile: {
            name: {
              first__icontains: 'Aman',
              last__icontains: 'Dugar',
            },
          },
        },
        new Q<User>().or([
          {
            profile: {
              contact: {
                email__in: ['aman@example.com', 'test@example.com'],
                phone__icontains: '123',
              },
            },
          },
          {
            profile: {
              address: {
                city__icontains: 'New York',
                street__icontains: 'Main',
              },
            },
          },
        ]),
      ]),
    )

    expect(query.getQuery()).toBe(
      "SELECT * FROM users WHERE (((((profile.name.first LIKE '%Aman%') AND (profile.name.last LIKE '%Dugar%')))) AND (((((profile.contact.email IN ('aman@example.com', 'test@example.com')) AND (profile.contact.phone LIKE '%123%')))) OR ((((profile.address.city LIKE '%New York%') AND (profile.address.street LIKE '%Main%'))))))",
    )
  })

  it('should handle nested objects with multiple levels', () => {
    const query = userModel.objects.filter({
      profile: {
        name: {
          first: 'Aman',
          last: 'Dugar',
        },
        contact: {
          email: 'aman@example.com',
          phone: '1234567890',
        },
        address: {
          street: '123 Main St',
          city: 'New York',
          country: 'USA',
        },
      },
    })

    expect(query.getQuery()).toBe(
      "SELECT * FROM users WHERE ((profile.name.first = 'Aman') AND (profile.name.last = 'Dugar') AND (profile.contact.email = 'aman@example.com') AND (profile.contact.phone = '1234567890') AND (profile.address.street = '123 Main St') AND (profile.address.city = 'New York') AND (profile.address.country = 'USA'))",
    )
  })
})
