import crypto from "node:crypto";
import mongoose from "mongoose";
import { Connection } from "../mongo";
import * as PasswordEncrypt from "../PasswordEncrypt";

export type privilegesKeys = "admin"|"users"|"addTokens";
export type privilegesValues = "read"|"write";
export type privileges = {
  admin: privilegesValues,
  users: privilegesValues,
  addTokens: privilegesValues
};

export type AuthToken = {
  CreatedAt: Date,
  UpdatedAt: Date,
  Token: string,
  TokenAlias?: string,
  Email?: string,
  Password?: PasswordEncrypt.passwordEncrypted,
  Privilages: privileges
};

export const authSchema = Connection.model<AuthToken>("Auth", new mongoose.Schema<AuthToken>({
  // Date Updates and Creation
  CreatedAt: {
    type: Date,
    default: () => new Date()
  },
  UpdatedAt: {
    type: Date,
    default: () => new Date()
  },
  // OFVp Token
  Token: {
    type: String,
    unique: true,
    default: () => "ofvpAuth_"+crypto.randomBytes(16).toString("hex")
  },
  // Token Alias
  TokenAlias: {
    type: String
  },
  // E-Mail
  Email: {
    type: String,
    required: true,
    unique: true
  },
  // Encrypted Password
  Password: {
    iv: {type: String, required: true},
    Encrypt: {type: String, required: true}
  },
  Privilages: {
    admin: {
      type: String,
      default: "read",
      enum: ["read", "write"]
    },
    users: {
      type: String,
      default: "read",
      enum: ["read", "write"]
    },
    addTokens: {
      type: String,
      default: "read",
      enum: ["read", "write"]
    }
  }
}, {
  versionKey: false,
  autoIndex: true,
  bufferCommands: false,
}));

/**
 * Create User auth token to meneger users and another tokens
 * @param user - User info
 * @returns - Returns a new AuthToken
 */
export async function createUserAuth(user: {Email: string, Password: string}): Promise<AuthToken> {
  if (typeof user.Email !== "string") throw new Error("Email is not a string");
  if (typeof user.Password !== "string") throw new Error("Password is not a string");
  if (user.Password.length <= 7) throw new Error("Password is too short");
  if (!!(await authSchema.collection.findOne({Email: user.Email}))) throw new Error("Email is already in use");
  const isFistUser = (await authSchema.collection.countDocuments()) === 0;
  return await authSchema.create({
    Email: user.Email,
    Password: PasswordEncrypt.EncryptPassword(user.Password),
    Privilages: {
      admin: isFistUser ? "write" : "read",
      users: isFistUser ? "write" : "read",
      addTokens: isFistUser ? "write" : "read"
    }
  });
}

/**
 * Create only token for alias to user with email and password
 * @param alias - Token Alias
 * @returns - Returns a AuthToken
 */
export async function createToken(alias: string): Promise<AuthToken> {
  if ((await authSchema.collection.countDocuments()) === 0) throw new Error("Register a user first");
  if (typeof alias !== "string") throw new Error("Alias is not a string");
  if (await authSchema.collection.findOne({Token: alias})) throw new Error("Token no exists");
  const userDoc = await authSchema.findOne({TokenAlias: alias}).lean();
  if (!!(userDoc)) throw new Error("Alias is already in use");
  if (!userDoc.Email) throw new Error("Is not user with email");
  const token = await authSchema.create({
    TokenAlias: alias,
    Privilages: {
      admin: "read",
      users: "read",
      addTokens: "read"
    },
  });
  await authSchema.findOneAndUpdate({token: alias}, {$push: {TokenAlias: token.Token}}).lean();
  return token;
}

/**
 * delete token and user register.
 *
 * On delete user register with email delete all tokens with alias
 *
 * @param option - Options to find token to delete
 * @returns
 */
export async function deleteToken(option: {Token?: string, Email?: string, Password?: string}): Promise<Array<AuthToken>> {
  if (option?.Token) {
    if (typeof option.Token !== "string") throw new Error("Token is not a string");
    if (!(await authSchema.collection.findOne({Token: option.Token}))) throw new Error("Token no exists");
    return [await authSchema.findOneAndDelete({Token: option.Token})];
  } else if (option?.Email) {
    if (typeof option.Email !== "string") throw new Error("Email is not a string");
    if (typeof option.Password !== "string") throw new Error("Password is not a string");
    const userDoc = await authSchema.findOne({Email: option.Email}).lean();
    if (!userDoc) throw new Error("Email no exists");
    if (!(await PasswordEncrypt.comparePassword(option.Password, Object(userDoc.Password)))) throw new Error("Password is wrong");
    const deletedTokens = await Promise.all((await authSchema.find({TokenAlias: userDoc.Token}).lean()).map(async (token) => authSchema.findOneAndDelete({Token: token.Token}).lean()));
    return [await authSchema.findOneAndDelete({Email: option.Email}).lean(), ...deletedTokens];
  }
  throw new Error("No option");
}

/**
 * Update user register privileges
 *
 * @param option
 * @returns
 */
export async function updatePrivilegies(option: {Token?: string, Email?: string, Password?: string, Privilages: privileges}): Promise<AuthToken> {
  if (option?.Token) {
    if (typeof option.Token !== "string") throw new Error("Token is not a string");
    if (!(await authSchema.collection.findOne({Token: option.Token}))) throw new Error("Token no exists");
    return authSchema.findOneAndUpdate({Token: option.Token}, {$set: {Privilages: option.Privilages, UpdatedAt: new Date()}}).lean();
  } else if (option?.Email) {
    if (typeof option.Email !== "string") throw new Error("Email is not a string");
    if (typeof option.Password !== "string") throw new Error("Password is not a string");
    const userDoc = await authSchema.findOne({Email: option.Email}).lean();
    if (!userDoc) throw new Error("Email no exists");
    if (!(await PasswordEncrypt.comparePassword(option.Password, Object(userDoc.Password)))) throw new Error("Password is wrong");
    return authSchema.findOneAndUpdate({Email: option.Email}, {$set: {Privilages: option.Privilages, UpdatedAt: new Date()}}).lean();
  }
  throw new Error("No option");
}

export async function updatePassword(user: {Email: string, Password: string, NewPassword: string}): Promise<AuthToken> {
  if (typeof user.Email !== "string") throw new Error("Email is not a string");
  if (typeof user.Password !== "string") throw new Error("Password is not a string");
  if (typeof user.NewPassword !== "string") throw new Error("NewPassword is not a string");
  const userDoc = await authSchema.findOne({Email: user.Email}).lean();
  if (!userDoc) throw new Error("Email no exists");
  if (!(await PasswordEncrypt.comparePassword(user.Password, Object(userDoc.Password)))) throw new Error("Password is wrong");
  return authSchema.findOneAndUpdate({Email: user.Email}, {$set: {Password: PasswordEncrypt.EncryptPassword(user.NewPassword), UpdatedAt: new Date()}}).lean();
}

export async function getAuth(user: {Email?: string, Password?: string, Token?: string}): Promise<AuthToken> {
  if (user.Token) {
    if (typeof user.Token !== "string") throw new Error("Token is not a string");
    const tokenDoc = authSchema.findOne({Token: user.Token}).lean();
    if (!tokenDoc) throw new Error("Token no exists");
    return tokenDoc;
  }
  if (typeof user.Email !== "string") throw new Error("Email is not a string");
  if (typeof user.Password !== "string") throw new Error("Password is not a string");
  const userDoc = await authSchema.findOne({Email: user.Email}).lean();
  if (!userDoc) throw new Error("Email no exists");
  if (!(await PasswordEncrypt.comparePassword(user.Password, Object(userDoc.Password)))) throw new Error("Password is wrong");
  return userDoc;
}

export async function findOne(option: {Email?: string, Password?: string, Token?: string}): Promise<AuthToken> {
  if (option.Token) {
    if (typeof option.Token !== "string") throw new Error("Token is not a string");
    const tokenDoc = authSchema.findOne({Token: option.Token}).lean();
    if (!tokenDoc) throw new Error("Token no exists");
    return tokenDoc;
  }
  if (typeof option.Email !== "string") throw new Error("Email is not a string");
  if (typeof option.Password !== "string") throw new Error("Password is not a string");
  const userDoc = await authSchema.findOne({Email: option.Email}).lean();
  if (!userDoc) throw new Error("Email no exists");
  return PasswordEncrypt.comparePassword(option.Password, Object(userDoc.Password)).then(isValid => isValid ? userDoc : Promise.reject("Password is wrong"));
}