import mongoose from "mongoose";
import { Connection } from "../mongo";
import * as Encrypt from "../PasswordEncrypt";

type sshType = {
  UserID: string,
  Username: string,
  Expire: Date,
  maxConnections: number,
  Password: {
    Encrypt: string,
    iv: string
  }
};

const sshSchema = Connection.model<sshType>("SSH", new mongoose.Schema<sshType>({
  UserID: {
    type: String,
    required: true,
    unique: true
  },
  Username: {
    type: String,
    required: true,
    unique: true
  },
  maxConnections: {
    type: Number,
    required: true,
    default: 5
  },
  Expire: {
    type: Date,
    required: true
  },
  Password: {
    Encrypt: {
      type: String,
      required: true
    },
    iv: {
      type: String,
      required: true
    }
  }
}));

export async function CreateUser(UserID: string, Username: string, DateExpire: Date, Password: string, maxConnections: number): Promise<sshType> {
  const UserData = await sshSchema.create({
    UserID: UserID,
    Username: Username,
    maxConnections: maxConnections,
    Expire: DateExpire,
    Password: Encrypt.EncryptPassword(Password)
  });
  return UserData;
}

export async function getUsers(): Promise<Array<sshType>> {
  return await sshSchema.find().lean();
}

export async function deleteUser(UserID: string): Promise<sshType> {
  return await sshSchema.findOneAndDelete({UserID}).lean();
}

export async function UpdatePassword(UserID: string, Password: string): Promise<sshType> {
  return await sshSchema.findOneAndUpdate({UserID: UserID}, {$set: {Password: Encrypt.EncryptPassword(Password)}}).lean();
}