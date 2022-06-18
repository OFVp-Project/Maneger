import * as util from "node:util";
import express, {Request, Response, NextFunction} from "express";
import * as yaml from "yaml";
import * as qrCode from "qrcode";
import * as expressUtil from "./expressUtil";
import * as sshManeger from "../schemas/ssh";
import * as Wireguard from "../schemas/Wireguard";
import * as usersIDs from "../schemas/UserID";
import RateLimit from "express-rate-limit";
export const user = express.Router();
user.use(expressUtil.catchExpressError);
if (process.env.NODE_ENV === "production") user.use(RateLimit({
  skipSuccessfulRequests: true,
  windowMs: 1000 * 60 * 2,
  message: "Too many requests from this IP, please try again after an minute.",
  max: 1000,
}));
const qrCodeCreate = util.promisify(qrCode.toBuffer) as (arg1: string) => Promise<Buffer>;
type userReqgisterBody = {Username: string; Password: string; expireDate: string; maxSshConnections: number|string; wireguardPeer: number|string;};
function authTokenVerify(req: Request, res: Response, next: NextFunction) {
  return expressUtil.sessionVerifyPrivilege({req: req, res: res, next: next}, [{req: "admin", value: "write"}, {req: "users", value: "write"}])
};
user.post<{}, {}, userReqgisterBody, {}>("/", authTokenVerify, async (req, res) => {
  const { Username, Password, expireDate, maxSshConnections, wireguardPeer } = req.body;
  const ErrorInputs:Array<{parameter: string, message: string}> = [];
  // Username
  if (!Username) ErrorInputs.push({parameter: "Username", message: "Username is required"});
  else if (typeof Username !== "string") ErrorInputs.push({parameter: "Username", message: "Username must be a string"});
  else if (Username.trim().toLowerCase().trim() === "root") return res.status(400).json({message: "not allowed to root username"});

  // Password
  if (!Password) ErrorInputs.push({parameter: "Password", message: "Password is required"});
  else if (typeof Password !== "string") ErrorInputs.push({parameter: "Password", message: "Password must be a string"});

  // Date
  const futureDate = new Date(Date.now() + (1000 * 60 * 60 * 24 * 2));
  if (!expireDate) ErrorInputs.push({parameter: "expireDate", message: "Date to expire is required"});
  else {
    const UserDate = new Date(expireDate);
    if (UserDate.toString() === "Invalid Date") ErrorInputs.push({parameter: "expireDate", message: "Date to expire is invalid, please use YYYY-MM-DD or javascript Date object"});
    else if (UserDate.getTime() <= futureDate.getTime()) ErrorInputs.push({parameter: "expireDate", message: "Date to expire is in the future, date input: "+UserDate.toString()+", min require date: "+futureDate.toString()});
  }
  // maxSshConnections
  if (parseInt(String(maxSshConnections)) !== 0) {if (isNaN(parseInt(String(maxSshConnections)))) ErrorInputs.push({parameter: "maxSshConnections", message: "Ssh connections is required"});}
  // wireguardPeer
  if (parseInt(String(wireguardPeer)) !== 0) {
    if (isNaN(parseInt(String(wireguardPeer)))) ErrorInputs.push({parameter: "wireguardPeer", message: "Count to get keys and ips to wireguard"});
    else if (parseInt(String(wireguardPeer)) > 500) ErrorInputs.push({parameter: "wireguardPeer", message: "Count to get keys and ips to wireguard must be less than 500"});
  }

  // if errors return errors
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
});

user.get("/", async ({res}) => {
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
});

user.delete<{}, {}, {Username: string}, {}>("/", authTokenVerify, async (req, res) => {
  const {Username} = req.body;
  if (!Username) return res.status(400).json({error: "Username is required"});
  else if (typeof Username !== "string") return res.status(400).json({error: "Username must be a string"});
  else if (Username.trim().toLowerCase().trim() === "root") return res.status(400).json({error: "not allowed to root username"});
  const user = await usersIDs.UserSchema.findOne({Username: Username});
  if (!user) return res.status(404).json({error: "User not found"});
  const ResDel = await Promise.all([Wireguard.DeleteKeys(user.UserId), sshManeger.deleteUser(user.UserId), usersIDs.DeleteUser(user.UserId)])
  return res.json(ResDel);
});

type wireguardConfigTypes = "wireguard"|"json"|"yaml"|"qrcode"|"openwrt18";
type wireguardJsonConfig = {
  Interface: {
    PrivateKey: string,
    Address: string[],
    DNS: string[]
  },
  Peer: {
    PublicKey: string,
    PresharedKey: string,
    Endpoint: string,
    Port: number,
    AllowedIPs: string[]
  }
};
const {WIREGUARD_HOST, WIREGUARD_PORT} = process.env;
if (!WIREGUARD_HOST) console.info("WIREGUARD_HOST is not defined, on request config will not be sent");
if (!WIREGUARD_PORT) console.info("WIREGUARD_PORT is not defined, on request config will not be sent");
user.get<{}, {}, any, {User: string, keyIndex?: string, fileType?: wireguardConfigTypes}>("/wireguardConfig", async (req, res) => {
  if (!WIREGUARD_HOST) return res.status(400).json({error: "WIREGUARD_HOST is not defined"});
  if (!WIREGUARD_PORT) return res.status(400).json({error: "WIREGUARD_PORT is not defined"});
  const {User} = req.query;
  let keyIndex = parseInt(req.query.keyIndex||"0"), fileType = req.query.fileType||"wireguard";
  if (isNaN(keyIndex)) keyIndex = 0;
  // Check user request is valid
  if (!User) return res.status(400).json({error: "User is required"});
  else if (typeof User !== "string") return res.status(400).json({error: "User must be a string"});

  // Check file type to return to user
  if (!fileType) return res.status(400).json({error: "File type is required"});
  else if (typeof fileType !== "string") return res.status(400).json({error: "File type must be a string, and must be one of the following: wireguard, qrcode, openwrt18, json, yaml"});
  else if (!["wireguard", "qrcode", "openwrt18", "json", "yaml"].includes(fileType)) return res.status(400).json({error: "File type must be one of wireguard, qrcode, openwrt18, json, yaml"});

  // Find user
  const wireguardConfig = await usersIDs.UserSchema.findOne({Username: User}).lean().then((userID) => Wireguard.WireguardSchema.findOne({UserId: userID.UserId}).lean());
  if (!wireguardConfig) return res.status(404).json({error: "User not found"});
  const wireguardPeerIndex = wireguardConfig.Keys[keyIndex];
  if (!wireguardPeerIndex) return res.status(404).json({error: "key index not found"});

  const config: wireguardJsonConfig = {
    Interface: {
      PrivateKey: wireguardPeerIndex.keys.Private,
      Address: [`${wireguardPeerIndex.ip.v4.ip}/${wireguardPeerIndex.ip.v4.mask}`, `${wireguardPeerIndex.ip.v6.ip}/${wireguardPeerIndex.ip.v6.mask}`],
      DNS: ["1.1.1.1", "1.0.0.1", "8.8.8.8", "8.8.4.4"]
    },
    Peer: {
      PublicKey: wireguardPeerIndex.keys.Public,
      PresharedKey: wireguardPeerIndex.keys.Preshared,
      AllowedIPs: ["0.0.0.0/0", "::0/0"],
      Endpoint: WIREGUARD_HOST,
      Port: parseInt(WIREGUARD_PORT)
    }
  };

  if (fileType === "json") return res.json(config);
  else if (fileType === "yaml") {
    res.setHeader("Content-Type", "text/yaml");
    return res.json(yaml.stringify(config));
  } else if (fileType === "qrcode"||fileType === "wireguard") {
    const wireguardConfigStyle = ([
      "[Interface]",
      `PrivateKey = ${config.Interface.PrivateKey}`,
      `Address = ${config.Interface.Address.join(", ")}`,
      `DNS = ${config.Interface.DNS.join(", ")}`,
      "",
      "[Peer]",
      `PublicKey = ${config.Peer.PublicKey}`,
      `PresharedKey = ${config.Peer.PresharedKey}`,
      `Endpoint = ${config.Peer.Endpoint}:${config.Peer.Port}`,
      `AllowedIPs = ${config.Peer.AllowedIPs.join(", ")}`
    ]).join("\n");
    if (fileType === "wireguard") {
      res.setHeader("Content-Type", "text/plain");
      return res.send(wireguardConfigStyle);
    }
    const qrcode = await qrCodeCreate(wireguardConfigStyle);
    res.setHeader("Content-Type", "image/png");
    return res.send(qrcode);
  }
  // openwrt 18
  const openwrt18Config = ([
    `config interface '${wireguardConfig.UserId}'`,
    "  option proto 'wireguard'",
    `  option private_key '${config.Interface.PrivateKey}'`,
    `  list addresses '${config.Interface.Address[0]}'`,
    `  list addresses '${config.Interface.Address[1]}'`,
    `config wireguard_${wireguardConfig.UserId}`,
    `  option description '${config.Peer.PublicKey}'`,
    `  option public_key '${config.Peer.PublicKey}'`,
    `  option preshared_key '${config.Peer.PresharedKey}'`,
    `  list allowed_ips '${config.Peer.AllowedIPs.join(", ")}'`,
    `  option endpoint_host '${config.Peer.Endpoint}'`,
    `  option endpoint_port '${config.Peer.Port}'`,
    `  option persistent_keepalive '25'`,
    `  option route_allowed_ips '1'`
  ]).join("\n");
  res.setHeader("Content-Type", "text/plain");
  return res.send(openwrt18Config);
});