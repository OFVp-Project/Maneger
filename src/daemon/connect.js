const fs = require("fs");
const http = require("http");
const { resolve } = require("path");
const SocketIo = require("socket.io");
const Server = http.createServer();
Server.listen(5000, () => console.log("Daemon listen in port 5000, dont expose to internet!"));
const io = new SocketIo.Server(Server);
module.exports.io = io;
io.use(function (socket, next){
  const { PASSWORD, USER } = socket.handshake.auth;
  const { DAEMON_PASSWORD, DAEMON_USER } = process.env;
  if (DAEMON_PASSWORD === undefined || DAEMON_USER === undefined) return next();
  if (!DAEMON_PASSWORD || !DAEMON_USER) return next();
  if (DAEMON_PASSWORD === PASSWORD && DAEMON_USER === USER) return next();
  console.error(`Failed auth to daemon socket.io id: ${socket.id}`);
  return next(new Error("Auth failed"));
});

const mongoUser = require("../mongo/Schemas/users");
const wireguardip = require("../mongo/Schemas/WireguardIpmaneger");

/**
 * Get wireguard interface key
 * @returns {{Preshared: string; Private: string; Public: string;}}
 */
const wireguardInterfaceConfig = () => {
  const storage = process.env.NODE_ENV === "development"? process.cwd():"/data";
  if (fs.existsSync(resolve(storage, "wireguardInterface.json"))) return JSON.parse(fs.readFileSync(resolve(storage, "wireguardInterface.json"), "utf8"));
  const keys = mongoUser.CreateWireguardKeys();
  fs.writeFileSync(resolve(storage, "wireguardInterface.json"), JSON.stringify(keys, null, 2));
  return keys;
}
module.exports.wireguardInterfaceConfig = wireguardInterfaceConfig;
mongoUser.on(async ({operationType, fullDocument}) => {
  io.emit("userOn", operationType, fullDocument);
  if (typeof fullDocument.passowrd !== "string") {
    const { DecryptPassword } = require("../PasswordEncrypt");
    const newDoc = fullDocument;
    newDoc.password = DecryptPassword(newDoc.password);
    io.emit("userOnDescrypt", newDoc);
  }
  io.emit("usersEncrypt", await mongoUser.getUsers());
  io.emit("usersDecrypt", await mongoUser.getUsersDecrypt());
  io.emit("wireguardConfig", {
    users: await mongoUser.getUsers(),
    WireguardIpConfig: {
      ip: await wireguardip.getWireguardip(),
      keys: wireguardInterfaceConfig()
    }
  });
});
io.on("connection", async socket => {
  console.log(`daemon Socket.io connect id: ${socket.id}`);
  socket.emit("usersEncrypt", await mongoUser.getUsers());
  socket.emit("usersDecrypt", await mongoUser.getUsersDecrypt());
  socket.emit("wireguardConfig", {
    users: await mongoUser.getUsers(),
    WireguardIpConfig: {
      ip: await wireguardip.getWireguardip(),
      keys: wireguardInterfaceConfig()
    }
  });
});
