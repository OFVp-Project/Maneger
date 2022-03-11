const crypto = require("crypto");
const { Schema } = require("mongoose");
const { Connection } = require("../connect");
const { EncryptPassword, DecryptPassword } = require("../../PasswordEncrypt");

const authSchema = Connection.model("AuthToken", new Schema({
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
}));

// jsdocs Types
/**
 * @type {{
 *   token: string;
 *   email: string;
 *   password: string|{
 *     iv: string;
 *     Encrypt: string;
 *   };
 *   privilages: "root"|"user";
 *   createdAt?: string;
 * }}
 */
const AuthToken = {
  token: "",
  email: "",
  password: {
    iv: "",
    Encrypt: ""
  },
  privilages: ""
}

// on actions
/** @type {Array<{operationType: "delete"|"insert"|"update"; fullDocument: AuthToken;}>} */
const onChangecallbacks=[];
/**
 * 
 * @param {(callback: {operationType: "delete"|"insert"|"update"; fullDocument: AuthToken;}) => void} callback 
 * @returns {void}
 */
module.exports.on = (callback) => onChangecallbacks.push(callback);
/**
 * 
 * @param {"delete"|"insert"|"update"} operationType
 * @param {AuthToken} data 
 */
function onRun(operationType, data) {onChangecallbacks.forEach(callback => callback({operationType, fullDocument: data}));}

// function to manipulate database
module.exports.getAuths = getAuths;
/**
 * 
 * @returns {Promise<Array<AuthToken>>}
 */
async function getAuths() {
  return await authSchema.find({}).lean();
}

module.exports.findBool = findBool;
async function findBool(EmailToken, Password) {
  const Auths = await getAuths();
  if (Password === undefined) {
    const AuthTokenObject = Auths.find(token => token.token === EmailToken);
    if (!AuthTokenObject) return false;
    return true;
  }
  const AuthTokenObject = Auths.find(token => token.email === EmailToken);
  if (!AuthTokenObject) return false;
  const StringPass = await DecryptPassword(AuthTokenObject.password);
  if (StringPass !== Password) return false;
  return true;
}

module.exports.checkAuth = checkAuth;
/**
 * 
 * @param {string} EmailToken 
 * @param {string|undefined} Password
 * @returns {Promise<AuthToken>}
 */
async function checkAuth(EmailToken, Password) {
  if (!(await findBool(EmailToken, Password))) throw new Error("email or token no exist");
  const Auths = await getAuths();
  if (Password === undefined) {
    const AuthTokenObject = Auths.find(token => token.token === EmailToken);
    if (!AuthTokenObject) throw new Error("Invalid Token");
    return AuthTokenObject;
  }
  const AuthTokenObject = Auths.find(token => token.email === EmailToken);
  if (!AuthTokenObject) throw new Error("Invalid Email");
  const StringPass = await DecryptPassword(AuthTokenObject.password);
  if (StringPass !== Password) throw new Error("Invalid Password");
  return AuthTokenObject;
}

module.exports.registerToken = registerToken;
/**
 * register new token
 * @param {{
 *   email: string;
 *   password: string;
 *   privilages: "root"|"user";
 * }} data
 * @returns {Promise<AuthToken>}
 */
async function registerToken(data) {
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
  await authSchema.create(AuthTokenObject);
  onRun("insert", AuthTokenObject);
  return AuthTokenObject;
}

module.exports.deleteAuth = deleteAuth;
/**
 * 
 * @param {string} EmailToken 
 * @param {string|undefined} Password
 * @returns {Promise<void>}
 */
async function deleteAuth(EmailToken, Password) {
  const AuthTokenObject = await checkAuth(EmailToken, Password);
  await authSchema.deleteOne({ token: AuthTokenObject.token });
  onRun("delete", AuthTokenObject);
  return;
}