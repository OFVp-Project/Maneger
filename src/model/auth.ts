import crypto from "crypto";
import { EncryptPassword, DecryptPassword } from "../PasswordEncrypt";
import mongoose from "mongoose";
import { Connection } from "../mongo";

export type AuthToken = {
  token: string;
  email: string;
  password: string|{
    iv: string;
    Encrypt: string;
  };
  privilages: "root"|"user";
  createdAt?: string;
};

const SchemaAuth = new mongoose.Schema<AuthToken>({
  // E-Mail Token
  token: {
    type: String,
    required: true,
    unique: true
  },
  // E-Mail
  email: {
    type: String,
    required: true,
    unique: true
  },
  // Password
  password: {
    iv: {
      type: String,
      required: true
    },
    Encrypt: {
      type: String,
      required: true
    }
  },
  privilages: {
    type: String,
    default: "user"
  },
  createdAt: {
    type: String,
    default: () => (new Date).toString()
  }
}, {
  versionKey: false,
  autoIndex: true,
  bufferCommands: false,
});
const authSchema = Connection.model("Auth", SchemaAuth);

// on actions
const onChangecallbacks: Array<(callback: {operationType: "delete"|"insert"|"update"; fullDocument: AuthToken;}) => void> = [];
export function on(callback: (callback: {operationType: "delete"|"insert"|"update"; fullDocument: AuthToken;}) => void) {onChangecallbacks.push(callback);};
function onRun(operationType: "delete"|"insert"|"update", data: AuthToken) {
  onChangecallbacks.forEach(callback => callback({
    operationType,
    fullDocument: data
  }));
}

// function to manipulate database
export async function getAuths(): Promise<Array<AuthToken>> {
  return await authSchema.find({}).lean();
}

export async function findBool(EmailToken: string, Password?: string): Promise<true|false> {
  const Auths = await getAuths();
  if (Password === undefined) {
    const AuthTokenObject = Auths.find(token => token.token === EmailToken);
    if (!AuthTokenObject) return false;
    return true;
  }
  const AuthTokenObject = Auths.find(token => token.email === EmailToken);
  if (!AuthTokenObject) return false;
  const StringPass = await DecryptPassword(Object(AuthTokenObject.password));
  if (StringPass !== Password) return false;
  return true;
}

export async function findOne(EmailToken: string, Password?: string): Promise<AuthToken|void> {
  const Auths = await getAuths();
  if (Password === undefined) {
    const AuthTokenObject = Auths.find(token => token.token === EmailToken);
    if (!AuthTokenObject) return;
    return AuthTokenObject;
  }
  const AuthTokenObject = Auths.find(token => token.email === EmailToken);
  if (!AuthTokenObject) return;
  const StringPass = await DecryptPassword(Object(AuthTokenObject.password));
  if (StringPass !== Password) return;
  return AuthTokenObject;
}

export async function checkAuth(EmailToken: string, Password?: string): Promise<AuthToken|void> {
  if (!(await findBool(EmailToken, Password))) throw new Error("email or token no exist");
  const Auths = await getAuths();
  if (Password === undefined) {
    const AuthTokenObject = Auths.find(token => token.token === EmailToken);
    if (!AuthTokenObject) throw new Error("Invalid Token");
    return AuthTokenObject;
  }
  const AuthTokenObject = Auths.find(token => token.email === EmailToken);
  if (!AuthTokenObject) throw new Error("Invalid Email");
  const StringPass = await DecryptPassword(Object(AuthTokenObject.password));
  if (StringPass !== Password) throw new Error("Invalid Password");
  return AuthTokenObject;
}

export async function registerToken(data: {email: string; password: string; privilages: "root"|"user";}): Promise<AuthToken> {
  if (!data.email) throw new Error("Email is required");
  if (!data.password) throw new Error("Password is required");
  if (!data.privilages) throw new Error("Privilages is required");
  if (!["root", "user"].includes(data.privilages)) throw new Error("Privilages must be 'root' or 'user'");
  if (data.password.length < 8) throw new Error("Password must be at least 8 characters");
  if ((await getAuths()).find(token => token.email === data.email)) throw new Error("Email is already registered");
  const Token = `Ofvp_${crypto.randomBytes(8).toString("hex")}`;
  const AuthTokenObject = {
    token: Token,
    email: data.email,
    password: await EncryptPassword(data.password),
    privilages: data.privilages
  };
  await authSchema.validate(AuthTokenObject);
  await authSchema.collection.insertOne(AuthTokenObject);
  onRun("insert", AuthTokenObject);
  return AuthTokenObject;
}

export async function deleteAuth(EmailToken: string, Password?: string): Promise<void> {
  const info = await checkAuth(EmailToken, Password);
  if (!info) throw new Error("email or token no exist");
  await authSchema.deleteOne({email: info.email});
  onRun("delete", info);
  return;
}

export async function update_privilegie(email: string, privilege: "root"|"user"): Promise<AuthToken|"no update"> {
  if (!(privilege === "root"||privilege === "user")) throw new Error("Privilege invalid.");
  const auth = (await getAuths()).find(us => us.email === email);
  if (!auth) throw new Error("email no exist!");
  if (auth.privilages === privilege) return "no update";
  auth.privilages = privilege;
  return await authSchema.updateOne({email: auth.email}, auth);
}