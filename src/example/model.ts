import { NumberField, StringField } from "../models"
import {
  FieldsOf,
  TableDefinition,
} from "../models/definitions/table-definition"
import { Model } from "../models/model"

type UserSchema = {
  id: string
  name: string
  email: string
  createdAt: number
  updatedAt: number
}

class User extends Model<UserSchema> {
  static fields: FieldsOf<UserSchema> = {
    id: new StringField({}),
    name: new StringField({}),
    email: new StringField({}),
    createdAt: new NumberField({}),
    updatedAt: new NumberField({}),
  }

  static tableDefinition: TableDefinition<UserSchema> = {
    tableName: "users",
    engine: "MergeTree",
    orderBy: ["createdAt"],
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
    tableName: "posts",
    engine: "MergeTree",
    orderBy: ["createdAt"],
  }
}

const models: (typeof Model<any, any>)[] = [User, Post]

export default models
