import mongoose from "mongoose";
import { Connection } from "../mongo";
import * as Encrypt from "../PasswordEncrypt";

export type sshType = {
  UserID: string,
  Username: string,
  expireDate: Date,
  maxConnections: number,
  Password: Encrypt.passwordEncrypted,
  currentConnections: number,
  dateTransfered: number,
  traffic: {
    restartDate: Date,
  }
};

export const sshSchema = Connection.model<sshType>("ssh", new mongoose.Schema<sshType, mongoose.Model<sshType, sshType, sshType, sshType>>({
  UserID: {type: String, required: true, unique: true},
  Username: {type: String, required: true, unique: true},
  Password: {Encrypt: {type: String, required: true}, iv: {type: String, required: true}},
  maxConnections: {type: Number, required: true, default: 5},
  expireDate: {type: Date, required: true},
  currentConnections: {type: Number, default: 0},
  dateTransfered: {type: Number, default: 0},
  traffic: {
    restartDate: {type: Date, default: () => new Date()},
  }
}));

export async function CreateUser(UserID: string, Username: string, DateExpire: Date, Password: string, maxConnections: number): Promise<sshType> {
  const UserData = await sshSchema.create({
    UserID: UserID,
    Username: Username,
    maxConnections: maxConnections,
    expireDate: DateExpire,
    Password: Encrypt.EncryptPassword(Password)
  });
  return UserData;
}

export async function getUsers(): Promise<Array<sshType>> {
  return await sshSchema.collection.find().toArray() as any;
}

export async function deleteUser(UserID: string): Promise<sshType> {
  return await sshSchema.findOneAndDelete({UserID}).lean();
}

export async function UpdatePassword(UserID: string, Password: string): Promise<sshType> {
  return await sshSchema.findOneAndUpdate({UserID: UserID}, {$set: {Password: Encrypt.EncryptPassword(Password)}}).lean();
}