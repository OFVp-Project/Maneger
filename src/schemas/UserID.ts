import crypto from "crypto";
import mongoose from "mongoose";
import { Connection } from "../mongo";

type userType = {
  UserId: string,
  Username: string,
  Expire: Date
};

const UserSchema = Connection.model<userType>("GeneralUser", new mongoose.Schema<userType>({
  UserId: {
    type: String,
    required: true,
    default: crypto.randomUUID,
    unique: true
  },
  Username: {
    type: String,
    required: true,
    unique: true
  },
  Expire: {
    type: Date,
    required: true
  }
}));

export async function RegisterUser(Username: string, DateExpire: Date): Promise<userType> {
  return await UserSchema.create({
    Username,
    Expire: DateExpire
  });
}

export async function GetUsers(): Promise<Array<userType>> {
  return await UserSchema.find().lean();
}

export async function DeleteUser(UserId: string): Promise<userType> {
  return await UserSchema.findOneAndDelete({UserId: UserId}).lean();
}