import * as path from "node:path";
import * as http from "node:http";
import * as util from "node:util";
import express from "express";
import RateLimit from "express-rate-limit";
import BodyParse from "body-parser";
import cors from "cors";
import ExpressSession, { Session } from "express-session";
import sessionStore from "session-file-store";
import * as yaml from "yaml";
import * as qrCode from "qrcode";
import { isDebug, onStorage } from "../pathControl";
import * as authSchema from "../schemas/auth";
import * as usersIDs from "../schemas/UserID";
import * as sshManeger from "../schemas/ssh";
import * as Wireguard from "../schemas/Wireguard";

// Express
export const app = express();
export const Server = http.createServer(app);
export const session = Session;

declare module "express-session" {
  interface Session {
    Session,
    userAuth?: authSchema.AuthToken
  }
}

app.use((req, _, next) => {
  next();
  console.log("[API] Request IP: %s Method: %s, Path: %s", req.ip, req.method, req.originalUrl);
});
app.use(cors());
app.use(BodyParse.urlencoded({extended: true}));
app.use(BodyParse.json());
function RemoveKeysFromJson(objRec, keyToDel: Array<string>) {
  return JSON.parse(JSON.stringify(objRec, (key, value) => {
    if (keyToDel.includes(key)) return undefined;
    else if (typeof value === "string") return value.replace(/\r\n/g, "\n");
    return value;
  }));
}
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


if (!process.env.COOKIE_SECRET) {
  console.log("COOKIE_SECRET is not defined");
  process.exit(1);
}
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
  if (typeof Email !== "string") return res.status(400).json({error: "Bad Request", message: "Email is required"});
  if (typeof Password !== "string") return res.status(400).json({error: "Bad Request", message: "Password is required"});
  return authSchema.getAuth({Email}).then(userAuth => {
    req.session.userAuth = userAuth;
    return new Promise((resolve, reject) => req.session.save((err?: Error) => {
      if (err) return reject(err);
      return resolve(userAuth);
    }));
  }).then(() => next()).catch(err => {
    res.status(401).json({
      error: "Unauthorized",
      message: String(err)
    });
  });
}

// Auth Routes
app.use("/auth", authEndpoints, RateLimit({windowMs: 60*1000, max: 10}));
app.route("/auth").get(({res}) => authSchema.authSchema.collection.find().toArray().then(data => res.json(data))).post<{}, {}, {email?: string, password?: string, token?: string}, {tokenOnly?: "true"|"false"}>(async (req, res): Promise<any> => {
  if (req.query.tokenOnly === "true") {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: "Token required" });
    if (typeof token !== "string") return res.status(400).json({ error: "Token must be a string" });
    return authSchema.createToken(token).then(token => res.json(token)).catch(err => res.status(400).json({ error: String(err) }));
  }
  // User Login
  const failures: Array<{Parameter: string, Error: string}> = [];
  const {email, password} = req.body;
  if (typeof email !== "string") failures.push({Parameter: "email", Error: "Invalid email"});
  if (!/[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/.test(email)) failures.push({Parameter: "email", Error: "Invalid email"});
  if (typeof password !== "string") failures.push({Parameter: "password", Error: "Invalid password"});
  if (password.length <= 7) failures.push({Parameter: "password", Error: "Invalid password length, must be at least 8 characters"});
  if (failures.length > 0) return res.status(400).json(failures);
  // Register in database
  return authSchema.createUserAuth({Email: email, Password: password}).then(user => res.json(user)).catch(err => res.status(400).json({ error: String(err) }));
}).put<{}, {}, {Email: string, Password: string, newPassword?: string}, authSchema.privileges>(async (req, res) => {
  const { Email, Password, newPassword } = req.body;
  if (typeof Email !== "string") return res.status(400).json({ error: "Invalid email" });
  if (!/[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/.test(Email)) return res.status(400).json({ error: "Invalid email" });
  if (typeof Password !== "string") return res.status(400).json({ error: "Invalid password" });
  if (Password.length <= 7) return res.status(400).json({ error: "Invalid password length, must be at least 8 characters" });
  if (!!newPassword) {
    if (typeof newPassword !== "string") return res.status(400).json({ error: "Invalid new password" });
    if (newPassword.length <= 7) return res.status(400).json({ error: "Invalid new password length, must be at least 8 characters" });
    return authSchema.updatePassword({Email: Email, Password: Password, NewPassword: newPassword}).then(data => res.json(data)).catch(err => res.status(400).json({ error: String(err) }));
  }
  const { admin, users, addTokens } = req.query;
  if (!(admin === "read" || admin === "write")) return res.status(400).json({ error: "Invalid admin query", allow: ["read", "write"] });
  if (!(users === "read" || users === "write")) return res.status(400).json({ error: "Invalid users query", allow: ["read", "write"] });
  if (!(addTokens === "read" || addTokens === "write")) return res.status(400).json({ error: "Invalid addTokens query", allow: ["read", "write"] });
  return authSchema.updatePrivilegies({Email: Email, Password: Password, Privilages: {admin: admin, users: users, addTokens: addTokens}}).then(data => res.json(data)).catch(err => res.status(400).json({ error: String(err) }));
}).delete<{}, {}, {email?: string, password?: string, token?: string}, {isToken?: "true"|"false"}>(async (req, res) => {
  if ((await authSchema.authSchema.countDocuments()) <= 1) return res.status(400).json({error: "Not allowed to delete last user, create new user first to delete this user"});
  if (req.query.isToken === "true") return authSchema.deleteToken({Token: req.body.token}).then(data => res.json(data)).catch(err => res.status(400).json({ error: String(err) }));
  const {email, password} = req.body;
  if (typeof email !== "string") return res.status(400).json({error: "Invalid email"});
  if (!/[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/.test(email)) return res.status(400).json({error: "Invalid email"});
  if (typeof password !== "string") return res.status(400).json({error: "Invalid password"});
  if (password.length <= 7) return res.status(400).json({error: "Invalid password length, must be at least 8 characters"});
  return authSchema.deleteToken({Email: email, Password: password}).then(data => res.json(data)).catch(err => res.status(400).json({ error: String(err) }));
});
const loginLimit = RateLimit({windowMs: 1*60*1000, max: 5});
app.route("/login").get(authEndpoints, async (req, res) => res.status(200).json(req.session)).post<{}, {}, {Token?: string, Email?: string, Password?: string}, {}>(loginLimit, async (req, res) => {
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
  if (!/[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/.test(Email)) return res.status(400).json({error: "Invalid email"});
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
  try {
    await new Promise((resolve, reject) => req.session.destroy(err => {if(err) return reject(err);resolve("")}));
    return res.sendStatus(200);
  } catch (err) {
    console.log(String(err.stack||err));
    return res.sendStatus(400).json({error: String(err.stack||err).split(/\r\n|\n/gi)});
  }
}).all(({res}) => res.status(405).json({error: "Method not allowed"}));
app.use(async (req, res, next) => {
  if (isDebug) return next();
  const users = await authSchema.authSchema.collection.countDocuments();
  if (users === 0) {
    console.log("[API] No auths found, capturing all requests");
    return res.status(403).json({error: "No auths found, capturing all requests, create new user to baypass this"});
  }
  return next();
});

// Users Routes
function ValidateRegister(req: {username: string; password: string; date_to_expire: string; ssh_connections: number|string; wireguard_peers: number|string;}) {
  const { username, password, date_to_expire, ssh_connections, wireguard_peers } = req;
  const ErrorInputs:Array<{parameter: string, message: string}> = [];
  if (!username) ErrorInputs.push({parameter: "username", message: "Username is required"});
  if (typeof username !== "string") ErrorInputs.push({parameter: "username", message: "Username must be a string"});
  if (!password) ErrorInputs.push({parameter: "password", message: "Password is required"});
  if (typeof password !== "string") ErrorInputs.push({parameter: "password", message: "Password must be a string"});
  if (!date_to_expire) ErrorInputs.push({parameter: "date_to_expire", message: "Date to expire is required"});
  const UserDate = new Date(date_to_expire);
  const futureDate = new Date(new Date().getTime() + (1000 * 60 * 60 * 24 * 2));
  if (UserDate.toString() === "Invalid Date") ErrorInputs.push({parameter: "date_to_expire", message: "Date to expire is invalid, please use YYYY-MM-DD or javascript Date object"});
  else if (UserDate.getTime() <= futureDate.getTime()) ErrorInputs.push({parameter: "date_to_expire", message: "Date to expire is in the future, date input: "+UserDate.toString()+", min require date: "+futureDate.toString()});
  if (parseInt(String(ssh_connections)) !== 0) {if (isNaN(parseInt(String(ssh_connections)))) ErrorInputs.push({parameter: "ssh_connections", message: "Ssh connections is required"});}
  if (parseInt(String(wireguard_peers)) !== 0) {
    if (isNaN(parseInt(String(wireguard_peers)))) ErrorInputs.push({parameter: "wireguard_peers", message: "Count to get keys and ips to wireguard"});
    else if (parseInt(String(wireguard_peers)) > 500) ErrorInputs.push({parameter: "wireguard_peers", message: "Count to get keys and ips to wireguard must be less than 500"});
  }
  return ErrorInputs;
}

app.route("/users").post(async (req, res) => {
  const { username, password, date_to_expire, ssh_connections, wireguard_peers } = req.body as {username: string; password: string; date_to_expire: string; ssh_connections: number|string; wireguard_peers: number|string;};
  const ErrorInputs = ValidateRegister({username, password, date_to_expire, ssh_connections, wireguard_peers});
  if (ErrorInputs.length > 0) return res.status(400).json(ErrorInputs);
  if (username.trim().toLowerCase().trim() === "root") return res.status(400).json({message: "not allowed to root username"});
  if (!!(await usersIDs.UserSchema.findOne({Username: String(username)}).lean())) return res.status(400).json({message: "username already exists"});
  // Register ID
  const UserId = await usersIDs.RegisterUser(username, new Date(date_to_expire));
  // Register SSH and Wireguard
  const [ssh, wireguard] = await Promise.all([
    sshManeger.CreateUser(UserId.UserId, username, new Date(date_to_expire), password, parseInt(String(ssh_connections))),
    Wireguard.AddKeys(UserId.UserId, parseInt(String(wireguard_peers)))
  ]);

  // Return data
  return res.json({
    UserId: UserId.UserId,
    Username: username,
    Expire: new Date(date_to_expire),
    Wireguard: wireguard,
    SSH: {
      maxConnections: ssh.maxConnections,
    }
  });
}).get(async ({res}) => {
  const [ids, ssh, wireguard] = await Promise.all([usersIDs.GetUsers(), sshManeger.getUsers(), Wireguard.getUsers()]);
  const usersMap = [];
  for (const id of ids) {
    const DDa = {
      ...id,
      ssh: ssh.find(ssh => ssh.UserID === id.UserId),
      wireguard: wireguard.find(wireguard => wireguard.UserId === id.UserId)
    };
    if (!!DDa.ssh) delete DDa.ssh.UserID;
    if (!!DDa.wireguard) delete DDa.wireguard.UserId;
    usersMap.push(DDa);
  }
  return res.json(usersMap);
}).delete(async (req, res) => {
  const {username} = req.body;
  const user = await usersIDs.UserSchema.findOne({Username: String(username)});
  if (!user) return res.status(404).json({error: "User not found"});
  const ResDel = await Promise.all([Wireguard.DeleteKeys(user.UserId), sshManeger.deleteUser(user.UserId), usersIDs.DeleteUser(user.UserId)])
  return res.json(ResDel);
});
const qrCodeCreate = util.promisify(qrCode.toBuffer);
type wireguardDefine = {
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

async function getWireguardconfig(Username: string, WireguardIndex: number = 0, host: string, port: number = 51820): Promise<wireguardDefine> {
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

app.get("/users/wireguard/:Type/:User", async (req, res) => {
  const { Type, User } = req.params;
  const wirepeerindex = parseInt(String(req.query.peer)||"0");
  const endpoint = process.env.WIREGUARD_HOST||String(req.query.host||req.headers.host||req.headers.Host||req.headers.hostname||req.headers.Hostname||"").replace(/\:.*/, "");
  const Port = parseInt(process.env.WIREGUARD_PORT||"51820");
  const ConfigUserInJson = await getWireguardconfig(User, wirepeerindex, endpoint, Port);
  const newInterface = ConfigUserInJson.Interface.Address.map(Ip => `${Ip.ip}/${Ip.mask}`)
  try {
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
  } catch (err) {
    return res.status(400).json({ error: String(err.stack||err).split(/\r\n|\n/gi) });
  }
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