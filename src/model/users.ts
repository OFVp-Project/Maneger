import crypto from "crypto";
import path from "path";
import fs from "fs";
import { DecryptPassword, EncryptPassword } from "../PasswordEncrypt";
import { gen_pool_ips, getWireguardip } from "../WireguardIpmaneger";

export type userType = {
  username: string;
  expire: Date;
  password: string|{
    iv: string;
    Encrypt: string;
  };
  ssh: {connections: number;};
  wireguard: Array<{
    keys: {
      Preshared: string;
      Private: string;
      Public: string;
    };
    ip: {
      v4: {ip: string; mask: string;};
      v6: {ip: string; mask: string;};
    }
  }>;
}

// Users Maneger Object
const userObject: {[username: string]: userType} = {};
const storagePath = (process.env.NODE_ENV === "development"||process.env.NODE_ENV === "testing")? process.cwd():"/data";
const userFile = path.join(storagePath, "users.json");
if (fs.existsSync(userFile)) {
  const usersLoad: typeof userObject = JSON.parse(fs.readFileSync(userFile, "utf8"));
  Object.keys(usersLoad).forEach(username => {userObject[username] = usersLoad[username];});
}

// on actions
const onChangecallbacks: Array<(callback: {operationType: "delete"|"insert"|"update"; fullDocument: userType;}) => void> = [];
export function on(callback: (callback: {operationType: "delete"|"insert"|"update"; fullDocument: userType;}) => void) {onChangecallbacks.push(callback);};
on(() => fs.writeFileSync(userFile, JSON.stringify(userObject, null, 2)));

function onRun(operationType: "delete"|"insert"|"update", data: userType) {
  onChangecallbacks.forEach(callback => callback({
    operationType,
    fullDocument: data
  }));
}

export async function getUsers() {
  return Object.keys(userObject).map(Username => userObject[Username]).map(user => {
    user.expire = new Date(user.expire);
    delete user["_id"];
    delete user["__v"];
    user.wireguard = user.wireguard.map(Peer => {
      delete Peer["_id"];
      return Peer;
    });
    return user;
  });
}

export async function getUsersDecrypt() {
  return (await getUsers()).map(user => {
    if (typeof user.password !== "object") throw new Error("Invalid Password storage");
    const password = DecryptPassword(Object(user.password));
    user.password = password;
    return user;
  });
}

export async function findOne(username: string): Promise<void|userType> {
  if (!userObject[username]) return;
  const user = userObject[username];
  user.expire = new Date(user.expire);
  delete user["_id"];
  delete user["__v"];
  user.wireguard = user.wireguard.map(Peer => {
    delete Peer["_id"];
    return Peer;
  })
  return user;
}

export async function CreateWireguardKeys(): Promise<{Preshared: string; Private: string; Public: string;}> {
  const randomKeys = () => crypto.generateKeyPairSync("x25519", {publicKeyEncoding: {format: "der", type: "spki"}, privateKeyEncoding: {format: "der", type: "pkcs8"}});
  const keysPairOne = randomKeys();
  const keysPairTwo = randomKeys();
  const keys = {
    Preshared: Buffer.from(keysPairTwo.privateKey.slice(16)).toString("base64"),
    Private: Buffer.from(keysPairOne.privateKey).slice(16).toString("base64"),
    Public: Buffer.from(keysPairOne.publicKey).slice(12).toString("base64"),
  };
  if (!!(await getUsers()).find(user => user.wireguard.find(Peer => Peer.keys.Public === keys.Public))) return CreateWireguardKeys();
  return keys;
}

export async function registersUser(data: {username: string; expire: Date; password: string; wireguard_peers: number; ssh_connections: number;}) {
  if (!data) throw new Error("Required user info to add user");
  if (!data.username) throw new Error("Required username to add user");
  if (!data.expire) throw new Error("Required expire to add user");
  if (!data.password) throw new Error("Required password to add user");
  if (data.wireguard_peers !== 0) {
    if (!data.wireguard_peers) throw new Error("Required wireguard_peers to add user");
  }
  if (data.ssh_connections !== 0) {
    if (!data.ssh_connections) throw new Error("Required ssh_connections to add user");
  }
  if (data.username.length < 3||data.username.length > 32) throw new Error("Username must be between 3 and 32 characters");
  if (data.expire.getTime() < new Date(new Date().getTime() + (1000 * 60 * 60 * 24 * 2)).getTime()) throw new Error("Expire must be less than 2 days");
  if (data.password.length < 8||data.password.length > 32) throw new Error("Password must be between 8 and 32 characters");
  if (data.wireguard_peers < 0) throw new Error("wireguard_peers must be greater than 0");
  if (data.ssh_connections < 0) throw new Error("ssh_connections must be greater than 0");
  if (await findOne(data.username)) throw new Error("Username already exists");
  const DataCreate = {
    username: data.username,
    expire: data.expire,
    password: EncryptPassword(data.password),
    ssh: {connections: data.ssh_connections},
    wireguard: await (async () => {
      const ipsArray: Array<{keys: {Preshared: string; Private: string; Public: string;}; ip: {v4: {ip: string; mask: string;}; v6: {ip: string; mask: string};}}> = [];
      if (data.wireguard_peers > 0) {
        const IpPool = (await gen_pool_ips(data.wireguard_peers))
        for (let i = 0; i < data.wireguard_peers; i++) {
          ipsArray.push({
            keys: await CreateWireguardKeys(),
            ip: IpPool[i]
          });
        }
      }
      return ipsArray;
    })()
  };
  console.log(DataCreate);
  userObject[data.username] = DataCreate;
  onRun("insert", DataCreate);
  return DataCreate;
}

export async function deleteUser(username: string): Promise<void> {
  if (!(await findOne(username))) throw new Error("User not found");
  const data = userObject[username]
  delete userObject[username];
  onRun("delete", data);
}

export async function updatePassword(Username: string, NewPassword: string) {
  if (!Username) throw new Error("Required username to update password");
  if (!NewPassword) throw new Error("Required new password to update password");
  if (NewPassword.length < 8||NewPassword.length > 32) throw new Error("Password must be between 8 and 32 characters");
  const userData = await findOne(Username);
  if (!userData) throw new Error("User not found");
  userData.password = EncryptPassword(NewPassword);
  userObject[Username] = userData;
  onRun("update", userData);
  return;
}

export async function wireguardInterfaceConfig(): Promise<{Preshared: string; Private: string; Public: string;}> {
  if (fs.existsSync(path.resolve(storagePath, "wireguardInterface.json"))) return JSON.parse(fs.readFileSync(path.resolve(storagePath, "wireguardInterface.json"), "utf8"));
  const keys = CreateWireguardKeys();
  fs.writeFileSync(path.resolve(storagePath, "wireguardInterface.json"), JSON.stringify(keys, null, 2));
  return keys;
}

export async function getWireguardconfig(Username: string, wireguardKey: number = 0, host: string, port: number = 51820): Promise<{
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
  }> {
  const WireguardKeys = Object(await findOne(Username)).wireguard;
  if (WireguardKeys.length === 0) throw new Error("No keys avaible");
  const ClientwireguardPeer = WireguardKeys[wireguardKey];
  const WireguardServer = {ip: await getWireguardip(), keys: await wireguardInterfaceConfig()};
  return {
    Interface: {
      PrivateKey: ClientwireguardPeer.keys.Private,
      Address: [ClientwireguardPeer.ip.v4, ClientwireguardPeer.ip.v6],
      DNS: [
        "8.8.8.8",
        "1.1.1.1",
        "8.8.4.4",
        "1.0.0.1"
      ],
    },
    Peer: {
      PublicKey: WireguardServer.keys.Public,
      PresharedKey: ClientwireguardPeer.keys.Preshared,
      Endpoint: host,
      Port: Math.floor(port),
      AllowedIPs: [
        "0.0.0.0/0",
        "::0/0"
      ]
    }
  };
}
