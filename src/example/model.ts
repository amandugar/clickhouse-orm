import { NumberField, StringField } from '../models'
import { FieldsOf, TableDefinition } from '../models/types/table-definition'
import { Model } from '../models/model'

type UserSchema = {
  id: number
  name: string
  email: string
  createdAt: number
  updatedAt: number
  deletedAt: number
}

class User extends Model<UserSchema> {
  static fields: FieldsOf<UserSchema> = {
    id: new NumberField({}),
    name: new StringField({}),
    email: new StringField({}),
    createdAt: new NumberField({}),
    updatedAt: new NumberField({}),
    deletedAt: new NumberField({}),
  }

  static tableDefinition: TableDefinition<UserSchema> = {
    tableName: 'users',
    engine: 'MergeTree',
    orderBy: ['createdAt'],
  }
}

type PostSchema = {
  id: string
  userId: string
  title: string
  content: string
  createdAt: number
  updatedAt: number
}

class Post extends Model<PostSchema> {
  static fields: FieldsOf<PostSchema> = {
    id: new StringField({}),
    userId: new StringField({}),
    title: new StringField({}),
    content: new StringField({}),
    createdAt: new NumberField({}),
    updatedAt: new NumberField({}),
  }

  static tableDefinition: TableDefinition<PostSchema> = {
    tableName: 'posts',
    engine: 'MergeTree',
    orderBy: ['createdAt'],
  }
}

const models: (typeof Model<any, any>)[] = [User, Post]

export default models
