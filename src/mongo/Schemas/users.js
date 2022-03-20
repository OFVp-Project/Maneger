const crypto = require("crypto"), path = require("path"), fs = require("fs");
const { Connection } = require("../connect");
const { Schema } = require("mongoose");
const { DecryptPassword, EncryptPassword } = require("../../PasswordEncrypt");
const { gen_pool_ips, getWireguardip } = require("./WireguardIpmaneger");

const UsersSchema = Connection.model("Users", new Schema({
  // Basic Info
  username: {
    type: String,
    required: true,
    unique: true
  },
  expire: {
    type: String,
    required: true
  },
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
  // SSH
  ssh: {
    connections: {
      type: Number,
      required: true
    }
  },
  // Wireguard Config
  wireguard: [
    {
      keys: {
        Preshared: {
          type: String,
          unique: true,
          required: true
        },
        Private: {
          type: String,
          unique: true,
          required: true
        },
        Public: {
          type: String,
          unique: true,
          required: true
        }
      },
      ip: {
        v4: {
          ip: {
            type: String,
            unique: true,
            required: true
          },
          mask: {
            type: String,
            required: true
          }
        },
        v6: {
          ip: {
            type: String,
            unique: true,
            required: true
          },
          mask: {
            type: String,
            required: true
          }
        }
      }
    }
  ]
}, {
  versionKey: false,
  autoIndex: true,
  bufferCommands: false,
}));

// jsdocs Types
/**
 * @type {{
 *  username: string;
 *  expire: Date;
 *  password: string|{
 *    iv: string;
 *    Encrypt: string;
 *  };
 *  ssh: {connections: number;};
 *  wireguard: Array<{
 *     keys: {
 *       Preshared: string;
 *       Private: string;
 *       Public: string;
 *     };
 *     ip: {
 *       v4: {ip: string; mask: string;};
 *       v6: {ip: string; mask: string;};
 *     }
 *   }>;
 * }}
 */
const typeUser = {
  username: "",
  expire: new Date(),
  password: {
    iv: "",
    Encrypt: "",
  },
  ssh: {connections: 0},
  wireguard: [{
    load: true,
    keys: {
      Preshared: "",
      Private: "",
      Public: "",
    },
    ip: {
      v4: {ip: "", mask: "",},
      v6: {ip: "", mask: "",},
    }
  }]
};

// on actions
/** @type {Array<{operationType: "delete"|"insert"|"update"; fullDocument: typeUser;}>} */
const onChangecallbacks=[];
/**
 * 
 * @param {(callback: {operationType: "delete"|"insert"|"update"; fullDocument: typeUser;}) => void} callback 
 * @returns {void}
 */
const on = (callback) => onChangecallbacks.push(callback);
module.exports.on = on;
/**
 * 
 * @param {"delete"|"insert"|"update"} operationType 
 * @param {typeUser} data 
 */
function onRun(operationType, data) {
  onChangecallbacks.forEach(callback => callback({
    operationType,
    fullDocument: data
  }));
}

// function to manipulate database
module.exports.getUsers = getUsers;
/**
 * Get all current users from database
 * @returns {Promise<Array<typeUser>>}
 */
async function getUsers() {
  /** @type {Array<typeUser>} */
  const data = await UsersSchema.find().lean();
  return data.map(user => {
    user.expire = new Date(user.expire);
    delete user["_id"];
    delete user["__v"];
    user.wireguard = user.wireguard.map(Peer => {
      delete Peer["_id"];
      return Peer;
    })
    return user;
  });
}

module.exports.getUsersDecrypt = getUsersDecrypt;
/**
 * Get all current users from database (Decrypted)
 * @returns {Promise<Array<typeUser>>}
 */
async function getUsersDecrypt() {
  const data = await getUsers();
  return data.map(user => {
    user.expire = new Date(user.expire);
    user.password = DecryptPassword(user.password);
    return user;
  });
}

on(async (operationType, data) => {
  daemon.io.emit("userOn", operationType, data);
  daemon.io.emit("usersEncrypt", await getUsers());
  daemon.io.emit("usersDecrypt", await getUsersDecrypt());
});

const daemon = require("../../daemon/connect");
daemon.io.on("connection", async socket => {
  console.info(`Sending users to daemon client id ${socket.id}`);
  const enUsers = await getUsers(), deUsers = await getUsersDecrypt();
  socket.emit("usersEncrypt", enUsers);
  socket.emit("usersDecrypt", deUsers);
});

module.exports.findOne = findOne;
/**
 * Find one user in the Database
 * @param {string} username
 * @return {Promise<typeUser|undefined>}
 */
async function findOne(username) {
  if (!username) throw new Error("Required username to find user");
  return (await getUsers()).find(user => user.username === username);
}

module.exports.CreateWireguardKeys = CreateWireguardKeys;
/**
 * Generate wireguard keys with crypto module.
 * 
 * @returns {{
 *   Preshared: string;
 *   Private: string;
 *   Public: string;
 * }}
 */
function CreateWireguardKeys() {
  /** @type {crypto.X25519KeyPairOptions} */
  const keysConfig = {publicKeyEncoding: {format: "der", type: "spki"}, privateKeyEncoding: {format: "der", type: "pkcs8"}};
  const keysPairOne = crypto.generateKeyPairSync("x25519", keysConfig);
  const keysPairTwo = crypto.generateKeyPairSync("x25519", keysConfig);
  return {
    Preshared: keysPairTwo.privateKey.slice(16).toString("base64"),
    Private: keysPairOne.privateKey.slice(16).toString("base64"),
    Public: keysPairOne.publicKey.slice(12).toString("base64"),
  };
}

module.exports.registersUser = registersUser;
/**
 * Register user in database
 * @param {{
 *   username: string;
 *   expire: Date;
 *   password: string;
 *   wireguard_peers: number;
 *   ssh_connections: number;
 * }} data - Basic info to register user
 * @returns {Promise<typeUser>}
 */
async function registersUser(data) {
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
  const Data = {
    username: data.username,
    expire: data.expire.toString(),
    password: EncryptPassword(data.password),
    ssh: {connections: data.ssh_connections},
    wireguard: []
  };
  if (data.wireguard_peers > 0) {
    const IpPool = (await gen_pool_ips(data.wireguard_peers))
    for (let i = 0; i < data.wireguard_peers; i++) {
      Data.wireguard.push({
        keys: CreateWireguardKeys(),
        ip: IpPool[i]
      });
    }
  }
  await UsersSchema.create(Data);
  onRun("insert", Data);
  return Data;
}

module.exports.deleteUser = deleteUser;
/**
 * delete one user
 * @param {string} username 
 */
async function deleteUser(username) {
  if (!username) throw new Error("Required username to delete user");
  const userData = await findOne(username);
  if (!userData) throw new Error("User not found");
  await UsersSchema.deleteOne({username: userData.username});
  onRun("delete", userData);
  return;
}

module.exports.deleteUsers = deleteUsers;
/**
 * delete one user
 * @param {Array<string>} Users 
 */
async function deleteUsers(Users) {
  if (!Users) throw new Error("Required Users to delete user");
  if (Users.find(User => typeof User !== "string")) throw new Error("Invalid username");
  const UsersBase = await getUsers();
  return await Promise.all(Users.map(async User => {
    const userData = UsersBase.find(Use => User === Use.username);
    await UsersSchema.deleteOne({username: userData.username});
    onRun("delete", userData);
    return userData;
  }));
}

module.exports.updatePassword = updatePassword;
/**
 * Update password of user
 * @param {string} Username 
 * @param {string} NewPassword 
 */
async function updatePassword(Username, NewPassword) {
  if (!Username) throw new Error("Required username to update password");
  if (!NewPassword) throw new Error("Required new password to update password");
  if (NewPassword.length < 8||NewPassword.length > 32) throw new Error("Password must be between 8 and 32 characters");
  const userData = await findOne(Username);
  if (!userData) throw new Error("User not found");
  userData.password = EncryptPassword(NewPassword);
  await UsersSchema.updateOne({username: userData.username}, userData);
  onRun("update", userData);
  return;
}

/**
 * Get wireguard interface key
 * @returns {{Preshared: string; Private: string; Public: string;}}
 */
function wireguardInterfaceConfig() {
  const storage = process.env.NODE_ENV === "development"? process.cwd():"/data";
  if (fs.existsSync(path.resolve(storage, "wireguardInterface.json"))) return JSON.parse(fs.readFileSync(path.resolve(storage, "wireguardInterface.json"), "utf8"));
  const keys = CreateWireguardKeys();
  fs.writeFileSync(path.resolve(storage, "wireguardInterface.json"), JSON.stringify(keys, null, 2));
  return keys;
}

module.exports.getWireguardconfig = getWireguardconfig;
/**
 * Create JSON with Interface config to User.
 * @param {string} Username - Username
 * @param {number} wireguardKey - Number to key index example: `0`
 * @param {string} host - host to Wireguard server with port
 * 
 * @returns {Promise<{
 *   Interface: {
 *     PrivateKey: string;
 *     Address: Array<{ip: string; mask: string;}>
 *     DNS: Array<string>;
 *   };
 *   Peer: {
 *     PublicKey: string;
 *     PresharedKey: string;
 *     Endpoint: string;
 *     Port: number;
 *     AllowedIPs: Array<string>
 *   };
 * }>}
 */
async function getWireguardconfig(Username, wireguardKey = 0, host, port = 51820) {
  const WireguardKeys = (await findOne(Username)).wireguard;
  if (WireguardKeys.length === 0) throw new Error("No keys avaible");
  const ClientwireguardPeer = WireguardKeys[wireguardKey];
  const WireguardServer = {ip: await getWireguardip(), keys: wireguardInterfaceConfig()};
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
      Port: parseInt(port),
      AllowedIPs: [
        "0.0.0.0/0",
        "::0/0"
      ]
    }
  };
}
