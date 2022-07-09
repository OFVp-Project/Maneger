import crypto from "crypto";
import mongoose from "mongoose";
import { Connection } from "../mongo";

export type userType = {
  UserId: string,
  Username: string,
  expireDate: Date
};

export const UserSchema = Connection.model<userType>("GeneralUser", new mongoose.Schema<userType, mongoose.Model<userType, userType, userType, userType>>({
  UserId: {
    type: String,
    required: true,
    unique: true
  },
  Username: {
    type: String,
    required: true,
    unique: true
  },
  expireDate: {
    type: Date,
    required: true
  }
}));

const createID = async (someBytes: number = 16): Promise<string> => {
  const id = "ofvpUser_"+crypto.randomBytes(someBytes).toString("hex");
  const user = await UserSchema.findOne({ UserId: id }).lean();
  if (!user) return id;
  return createID(someBytes+1);
}

export async function RegisterUser(Username: string, DateExpire: Date): Promise<userType> {
  if (typeof Username !== "string") throw new Error("Username must be a string");
  else if (Username.length < 3) throw new Error("Username must be at least 3 characters");

  return await UserSchema.create({
    UserId: await createID(),
    Username: Username,
    expireDate: DateExpire,
  });
}

export async function GetUsers(): Promise<Array<userType>> {
  return await UserSchema.collection.find().toArray() as any;
}

export async function DeleteUser(UserId: string): Promise<userType> {
  return await UserSchema.findOneAndDelete({UserId: UserId}).lean();
}

export async function findOne(Username: string): Promise<userType> {
  if (typeof Username !== "string") throw new Error("Username must be a string");
  // else if (Username.length < 3) throw new Error("Username must be at least 3 characters");
  return await UserSchema.findOne({Username: Username}).lean();
}