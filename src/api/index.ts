import * as path from "node:path";
import * as http from "node:http";
import * as util from "node:util";
import * as socket_io from "socket.io";
import express from "express";
import RateLimit from "express-rate-limit";
import BodyParse from "body-parser";
import cors from "cors";
import ExpressSession from "express-session";
import sessionStore from "session-file-store";
import * as yaml from "yaml";
import * as qrCode from "qrcode";
import * as authSchema from "../schemas/auth";
import * as usersIDs from "../schemas/UserID";
import * as sshManeger from "../schemas/ssh";
import * as Wireguard from "../schemas/Wireguard";
import { isDebug, onStorage, emailValidate } from "../pathControl";
const qrCodeCreate = util.promisify(qrCode.toBuffer);
type wireguardUserConfig = {
  Interface: {
    PrivateKey: string;
    Address: Array<{ip: string; mask: string;}>
    DNS: Array<string>;
  };
  Peer: {
    PublicKey: string;
    PresharedKey: string;
    Endpoint: string;
    Port: number;
    AllowedIPs: Array<string>
  };
};
async function getWireguardconfig(Username: string, WireguardIndex: number = 0, host: string, port: number = 51820): Promise<wireguardUserConfig> {
  if (isNaN(WireguardIndex)) WireguardIndex = 0;
  const UserId = (await usersIDs.GetUsers()).find(user => user.Username === Username);
  if (!UserId) throw new Error("User not found");
  const wireguard = await Wireguard.findOne(UserId.UserId);
  if (!wireguard) throw new Error("Wireguard not found");
  const Interface = wireguard[WireguardIndex];
  if (!Interface) throw new Error("Wireguard not found");
  return {
    Interface: {
      PrivateKey: Interface.keys.Private,
      Address: [Interface.ip.v4, Interface.ip.v6],
      DNS: [
        "8.8.8.8",
        "1.1.1.1",
        "8.8.4.4",
        "1.0.0.1"
      ]
    },
    Peer: {
      PublicKey: Interface.keys.Public,
      PresharedKey: Interface.keys.Preshared,
      Endpoint: host,
      Port: Math.floor(port),
      AllowedIPs: [
        "0.0.0.0/0",
        "::0/0"
      ]
    }
  };
}

function RemoveKeysFromJson(objRec, keyToDel: Array<string>) {
  return JSON.parse(JSON.stringify(objRec, (key, value) => {
    if (keyToDel.includes(key)) return undefined;
    else if (typeof value === "string") return value.replace(/\r\n/g, "\n");
    return value;
  }));
}

// Express
export const app = express();
export const Server = http.createServer(app);
export const io = new socket_io.Server(Server, {transports: ["websocket", "polling"], cors: {origin: "*"}});
if (!process.env.COOKIE_SECRET) {
  console.log("COOKIE_SECRET is not defined");
  process.exit(1);
}
app.use(cors());
app.use(BodyParse.urlencoded({extended: true}));
app.use(BodyParse.json());
app.use((req, _res, next) => {
  next();
  console.log("[API] Request IP: %s Method: %s, Path: %s", req.ip, req.method, req.originalUrl);
});
app.use((req, res, next) => {
  res.json = (body) => {
    body = RemoveKeysFromJson(body, ["__v", "_id"]);
    if (req.query.type === "yaml"||req.query.type === "yml") {
      res.setHeader("Content-Type", "text/yaml");
      res.send(yaml.stringify(body));
      return res;
    }
    res.set("Content-Type", "application/json");
    res.send(JSON.stringify(body, (_, value) => {
      if (typeof value === "bigint") return value.toString();
      return value;
    }, 2));
    return res;
  }
  return next();
});
app.use(ExpressSession({
  secret: process.env.COOKIE_SECRET,
  name: "ofvp_session",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: false,
    secure: "auto",
    maxAge: (1000 * 60 * 60 * 24 * 30),
  },
  store: new (sessionStore(ExpressSession))({
    path: path.join(onStorage, "sessionsDir"),
    secret: process.env.COOKIE_SECRET
  })
}));
declare module "express-session" {
  export interface Session {
    userAuth?: authSchema.AuthToken
  }
}
async function authEndpoints(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (isDebug||(await authSchema.authSchema.collection.countDocuments()) === 0) {
    console.log(isDebug ? "Debug mode is on" : "No users in database");
    return next();
  }
  if (req.session?.userAuth) {
    return authSchema.getAuth({Token: req.session.userAuth.Token}).then(() => next()).catch(err => {
      res.status(401).json({
        error: "Unauthorized",
        message: String(err)
      });
    });
  }
  const Email = req.body.AuthEmail || req.headers.ofvpemail;
  const Password = req.body.AuthPassword || req.headers.ofvppassword;
  if (typeof Email !== "string") return res.status(401).json({error: "Unauthorized", message: "Email required"});
  if (typeof Password !== "string") return res.status(401).json({error: "Unauthorized", message: "Password required"});
  return authSchema.getAuth({Email, Password}).then(userAuth => {
    req.session.userAuth = userAuth;
    return new Promise((resolve, reject) => req.session.save((err?: Error) => {
      if (err) return reject(err);
      return resolve(userAuth);
    }));
  }).then(() => next()).catch(err => {
    res.status(401).json({
      error: "Unauthorized",
      message: String(err).replace("Error: ", "")
    });
  });
};

// Auth Routes
const loginLimit = RateLimit({windowMs: 1*60*1000, max: 5});
app.route("/login").get(({res}) => res.sendFile(path.join(__dirname, "./login.html"))).post<{}, {}, {Token?: string, Email?: string, Password?: string}, {}>(loginLimit, async (req, res) => {
  if (req.session.userAuth) return res.status(200).json(req.session.userAuth);
  const {Token, Email, Password} = req.body;
  if (!!Token) {
    if (typeof Token !== "string") return res.status(400).json({error: "Invalid token"});
    return authSchema.getAuth({Token: Token}).then(userToken => {
      req.session.userAuth = userToken;
      return new Promise((resolve, reject) => req.session.save((err?: Error) => {
        if (err) return reject(err);
        return resolve(userToken);
      }));
    }).then(res.json).catch(err => res.status(400).json({error: String(err)}));
  }
  if (typeof Email !== "string") return res.status(400).json({error: "Invalid email"});
  if (!emailValidate.test(Email)) return res.status(400).json({error: "Invalid email"});
  if (typeof Password !== "string") return res.status(400).json({error: "Invalid password"});
  if (Password.length <= 7) return res.status(400).json({error: "Invalid password length, must be at least 8 characters"});
  return authSchema.getAuth({Email: Email, Password: Password}).then(userAuth => {
    req.session.userAuth = userAuth;
    return new Promise((resolve, reject) => req.session.save((err?: Error) => {
      if (err) return reject(err);
      return resolve(userAuth);
    }));
  }).then(res.json).catch(err => res.status(400).json({error: String(err)}));
}).delete(loginLimit, async (req, res) => {
  if (!req.session.userAuth) return res.status(400).json({error: "No user logged in"});
  try {
    await new Promise((resolve, reject) => req.session.destroy(err => {if(err) return reject(err);resolve("")}));
    return res.sendStatus(200);
  } catch (err) {
    console.log(String(err.stack||err));
    return res.sendStatus(400).json({error: String(err.stack||err).split(/\r\n|\n/gi)});
  }
}).all(({res}) => res.status(405).json({error: "Method not allowed"}));

// Token Routes
const auth = express.Router();
app.use("/auth", RateLimit({windowMs: 60*1000, max: 10}), authEndpoints, auth);
auth.route("/").get(({res}) => authSchema.authSchema.collection.find().toArray().then(data => res.json(data))).post<{}, {}, {email?: string, password?: string, token?: string}, {tokenOnly?: "true"|"false"}>(async (req, res): Promise<any> => {
  if (!(req.session.userAuth.Privilages.admin === "write"||req.session.userAuth.Privilages.addTokens === "write")) return res.status(403).json({error: "Forbidden", message: "You don't have permission to do this"});
  if (req.query.tokenOnly === "true") {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: "Token required" });
    if (typeof token !== "string") return res.status(400).json({ error: "Token must be a string" });
    if (req.session.userAuth.Token === token) return res.status(401).json({ error: "Unauthorized", message: "Token already used" });
    return authSchema.createToken(token).then(token => res.json(token)).catch(err => res.status(400).json({ error: String(err) }));
  }
  // User Login
  const failures: Array<{Parameter: string, Error: string}> = [];
  const {email, password} = req.body;
  if (typeof email !== "string") failures.push({Parameter: "email", Error: "Invalid email"});
  else if (!emailValidate.test(email)) failures.push({Parameter: "email", Error: "Invalid email"});
  else if (req.session.userAuth?.Email === email) failures.push({Parameter: "email", Error: "Email already used"});
  if (typeof password !== "string") failures.push({Parameter: "password", Error: "Invalid password"});
  else if (password?.length <= 7) failures.push({Parameter: "password", Error: "Invalid password length, must be at least 8 characters"});
  if (failures.length > 0) return res.status(400).json(failures);
  // Register in database
  return authSchema.createUserAuth({Email: email, Password: password}).then(user => res.json(user)).catch(err => res.status(400).json({ error: String(err) }));
}).put<{}, {}, {Email: string, Password: string, newPassword?: string}, authSchema.privileges>(async (req, res) => {
  const { Email, Password, newPassword } = req.body;
  if (typeof Email !== "string") return res.status(400).json({ error: "Invalid email" });
  else if (!emailValidate.test(Email)) return res.status(400).json({ error: "Invalid email" });
  else if (!(req.session.userAuth.Privilages.admin === "write"||req.session.userAuth.Privilages.addTokens === "write"||req.session.userAuth.Email === Email)) return res.status(403).json({error: "Forbidden", message: "You don't have permission to do this"});
  if (typeof Password !== "string") return res.status(400).json({ error: "Invalid password" });
  else if (Password.length <= 7) return res.status(400).json({ error: "Invalid password length, must be at least 8 characters" });
  if (!!newPassword) {
    if (typeof newPassword !== "string") return res.status(400).json({ error: "Invalid new password" });
    else if (newPassword.length <= 7) return res.status(400).json({ error: "Invalid new password length, must be at least 8 characters" });
    return authSchema.updatePassword({Email: Email, Password: Password, NewPassword: newPassword}).then(data => res.json(data)).catch(err => res.status(400).json({ error: String(err) }));
  }
  if (!(req.session.userAuth.Privilages.admin === "write"||req.session.userAuth.Privilages.addTokens === "write")) return res.status(403).json({error: "Forbidden", message: "You don't have permission to do this"});
  const { admin, users, addTokens } = req.query;
  if (!(admin === "read" || admin === "write")) return res.status(400).json({ error: "Invalid admin query", allow: ["read", "write"] });
  if (!(users === "read" || users === "write")) return res.status(400).json({ error: "Invalid users query", allow: ["read", "write"] });
  if (!(addTokens === "read" || addTokens === "write")) return res.status(400).json({ error: "Invalid addTokens query", allow: ["read", "write"] });
  return authSchema.updatePrivilegies({Email: Email, Password: Password, Privilages: {admin: admin, users: users, addTokens: addTokens}}).then(data => res.json(data)).catch(err => res.status(400).json({ error: String(err) }));
}).delete<{}, {}, {email?: string, password?: string, token?: string}, {isToken?: "true"|"false"}>(async (req, res) => {
  if ((await authSchema.authSchema.countDocuments()) <= 1) return res.status(400).json({error: "Not allowed to delete last user, create new user first to delete this user"});
  if (!(req.session.userAuth.Privilages.admin === "write"||req.session.userAuth.Privilages.addTokens === "write")) return res.status(403).json({error: "Forbidden", message: "You don't have permission to do this"});
  if (req.query.isToken === "true") return authSchema.deleteToken({Token: req.body.token}).then(data => res.json(data)).catch(err => res.status(400).json({ error: String(err) }));
  const {email, password} = req.body;
  if (typeof email !== "string") return res.status(400).json({error: "Invalid email"});
  else if (!emailValidate.test(email)) return res.status(400).json({error: "Invalid email"});
  if (typeof password !== "string") return res.status(400).json({error: "Invalid password"});
  else if (password.length <= 7) return res.status(400).json({error: "Invalid password length, must be at least 8 characters"});
  return authSchema.deleteToken({Email: email, Password: password}).then(data => res.json(data)).catch(err => res.status(400).json({ error: String(err) }));
});

// Users Routes
app.use(authEndpoints, async (_req, res, next) => {
  if (isDebug) return next();
  const users = await authSchema.authSchema.collection.countDocuments();
  if (users === 0) {
    console.log("[API] No auths found, capturing all requests");
    return res.status(403).json({error: "No auths found, capturing all requests, create new user to baypass this"});
  }
  return next();
});
type userReqgisterBody = {Username: string; Password: string; expireDate: string; maxSshConnections: number|string; wireguardPeer: number|string;};
app.route("/users").post<{}, {}, userReqgisterBody, {}>(async (req, res) => {
  if (!(req.session.userAuth.Privilages.admin === "write"||req.session.userAuth.Privilages.users === "write")) return res.status(403).json({error: "Forbidden", message: "You don't have permission to do this"});
  const { Username, Password, expireDate, maxSshConnections, wireguardPeer } = req.body;
  const ErrorInputs:Array<{parameter: string, message: string}> = [];
  if (!Username) ErrorInputs.push({parameter: "Username", message: "Username is required"});
  else if (typeof Username !== "string") ErrorInputs.push({parameter: "Username", message: "Username must be a string"});
  else if (Username.trim().toLowerCase().trim() === "root") return res.status(400).json({message: "not allowed to root username"});
  if (!Password) ErrorInputs.push({parameter: "Password", message: "Password is required"});
  else if (typeof Password !== "string") ErrorInputs.push({parameter: "Password", message: "Password must be a string"});
  if (!expireDate) ErrorInputs.push({parameter: "expireDate", message: "Date to expire is required"});
  const UserDate = new Date(expireDate);
  const futureDate = new Date(new Date().getTime() + (1000 * 60 * 60 * 24 * 2));
  if (UserDate.toString() === "Invalid Date") ErrorInputs.push({parameter: "expireDate", message: "Date to expire is invalid, please use YYYY-MM-DD or javascript Date object"});
  else if (UserDate.getTime() <= futureDate.getTime()) ErrorInputs.push({parameter: "expireDate", message: "Date to expire is in the future, date input: "+UserDate.toString()+", min require date: "+futureDate.toString()});
  if (parseInt(String(maxSshConnections)) !== 0) {if (isNaN(parseInt(String(maxSshConnections)))) ErrorInputs.push({parameter: "maxSshConnections", message: "Ssh connections is required"});}
  if (parseInt(String(wireguardPeer)) !== 0) {
    if (isNaN(parseInt(String(wireguardPeer)))) ErrorInputs.push({parameter: "wireguardPeer", message: "Count to get keys and ips to wireguard"});
    else if (parseInt(String(wireguardPeer)) > 500) ErrorInputs.push({parameter: "wireguardPeer", message: "Count to get keys and ips to wireguard must be less than 500"});
  }
  if (ErrorInputs.length > 0) return res.status(400).json(ErrorInputs);
  if (!!(await usersIDs.UserSchema.findOne({Username: String(Username)}).lean())) return res.status(400).json({message: "username already exists"});
  // Register ID
  const UserId = await usersIDs.RegisterUser(Username, new Date(expireDate));
  // Register SSH and Wireguard
  const [ssh, wireguard] = await Promise.all([
    sshManeger.CreateUser(UserId.UserId, Username, new Date(expireDate), Password, parseInt(String(maxSshConnections))),
    Wireguard.AddKeys(UserId.UserId, parseInt(String(wireguardPeer)))
  ]);

  // Return data
  return res.json({
    UserId: UserId.UserId,
    Username: Username,
    Expire: new Date(expireDate),
    Wireguard: wireguard,
    SSH: {
      maxConnections: ssh.maxConnections,
    }
  });
}).get(async ({res}) => {
  const [ids, ssh, wireguard] = await Promise.all([usersIDs.GetUsers(), sshManeger.getUsers(), Wireguard.getUsers()]);
  const usersMap = [];
  for (const id of ids) {
    const UserIDOldStyle = {
      ...id,
      ssh: ssh.find(ssh => ssh.UserID === id.UserId),
      wireguard: wireguard.find(wireguard => wireguard.UserId === id.UserId)
    };
    if (!!UserIDOldStyle.ssh) delete UserIDOldStyle.ssh.UserID;
    if (!!UserIDOldStyle.wireguard) delete UserIDOldStyle.wireguard.UserId;
    usersMap.push(UserIDOldStyle);
  }
  return res.json(usersMap);
}).delete<{}, {}, {Username: string}, {}>(async (req, res) => {
  if (!(req.session.userAuth.Privilages.admin === "write"||req.session.userAuth.Privilages.users === "write")) return res.status(403).json({error: "Forbidden", message: "You don't have permission to do this"});
  const {Username} = req.body;
  if (!Username) return res.status(400).json({error: "Username is required"});
  else if (typeof Username !== "string") return res.status(400).json({error: "Username must be a string"});
  else if (Username.trim().toLowerCase().trim() === "root") return res.status(400).json({error: "not allowed to root username"});
  const user = await usersIDs.UserSchema.findOne({Username: Username});
  if (!user) return res.status(404).json({error: "User not found"});
  const ResDel = await Promise.all([Wireguard.DeleteKeys(user.UserId), sshManeger.deleteUser(user.UserId), usersIDs.DeleteUser(user.UserId)])
  return res.json(ResDel);
});

app.get("/wireguard/:Type/:User", async (req, res) => {
  const endpoint = process.env.WIREGUARD_HOST||String(req.query.host||req.headers.host||req.headers.Host||req.headers.hostname||req.headers.Hostname||"").replace(/\:.*/, "");
  const Port = parseInt(process.env.WIREGUARD_PORT||"51820");
  const { Type, User } = req.params;
  if (!Type) return res.status(400).json({error: "Type is required"});
  else if (typeof Type !== "string") return res.status(400).json({error: "Type must be a string"});
  if (!User) return res.status(400).json({error: "User is required"});
  else if (typeof User !== "string") return res.status(400).json({error: "User must be a string"});
  const wirepeerindex = parseInt(String(req.query.peer)||"0");
  const ConfigUserInJson = await getWireguardconfig(User, wirepeerindex, endpoint, Port);
  const newInterface = ConfigUserInJson.Interface.Address.map(Ip => `${Ip.ip}/${Ip.mask}`)
  // Create Client Config
  if (Type === "wireguard"||Type === "qrcode") {
    const WireguardConfig = ([
      "[Interface]",
      `PrivateKey = ${ConfigUserInJson.Interface.PrivateKey}`,
      `Address = ${newInterface.join(",")}`,
      `DNS = ${ConfigUserInJson.Interface.DNS.join(",")}`,
      "",
      "[Peer]",
      `PublicKey = ${ConfigUserInJson.Peer.PublicKey}`,
      `PresharedKey = ${ConfigUserInJson.Peer.PresharedKey}`,
      `Endpoint = ${ConfigUserInJson.Peer.Endpoint}:${ConfigUserInJson.Peer.Port}`,
      `AllowedIPs = ${ConfigUserInJson.Peer.AllowedIPs.join(",")}`
    ]).join("\n");
    if (Type === "qrcode") {
      res.setHeader("Content-Type", "image/png");
      return res.send(await qrCodeCreate(WireguardConfig));
    }
    res.setHeader("Content-Type", "text/plain");
    return res.send(WireguardConfig);
  }
  else if (Type === "json") return res.json(ConfigUserInJson);
  else if (Type === "yaml") {
    res.setHeader("Content-Type", "text/yaml");
    return res.send(yaml.stringify(ConfigUserInJson));
  }
  else if (Type === "openwrt18") {
    const RandomInterfaceName = Math.random().toString(36).substring(2, 15).slice(0, 8);
    res.setHeader("Content-Type", "text/plain");
    return res.send(([
      `config interface '${RandomInterfaceName}'`,
      `  option proto 'wireguard'`,
      `  option private_key '${ConfigUserInJson.Interface.PrivateKey}'`,
      ...newInterface.map(Address => `  list addresses '${Address}'`),
      "",
      `config wireguard_${RandomInterfaceName}`,
      `  option description '${RandomInterfaceName}Peer'`,
      `  option public_key '${ConfigUserInJson.Peer.PublicKey}'`,
      `  option preshared_key '${ConfigUserInJson.Peer.PresharedKey}'`,
      ...ConfigUserInJson.Peer.AllowedIPs.map(IP => `  list allowed_ips '${IP}'`),
      `  option endpoint_host '${ConfigUserInJson.Peer.Endpoint}'`,
      `  option endpoint_port '${ConfigUserInJson.Peer.Port}'`,
      "  option persistent_keepalive '25'",
      "  option route_allowed_ips '1'"
    ]).join("\n"));
  }
  return res.status(400).json({ error: "Valid: wireguard, qrcode, openwrt18, json, yaml" });
});

// Send 404 for all other routes
app.use((req, res) => res.status(404).json({
  message: "Path don't exist in API",
  error: "Path don't exist in API",
  status: 404,
  pathReq: req.originalUrl,
}));

// Catch errors
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.status(500).json({
    message: "Sorry an error occured, please try again later",
    error: String(err),
    status: 500,
    pathReq: req.originalUrl
  });
  console.trace(err);
  return {err, req, res, next};
});