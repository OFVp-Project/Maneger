const fs = require("fs");
const http = require("http");
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

const mongoUser = require("../mongo/v3/users");
const wireguardip = require("../mongo/v3/WireguardIpmaneger");

/**
 * Get wireguard interface key
 * @returns {{Preshared: string; Private: string; Public: string;}}
 */
const wireguardInterfaceConfig = () => {
  if (fs.existsSync("/data/wireguardInterface.json")) return JSON.parse(fs.readFileSync("/data/wireguardInterface.json", "utf8"));
  const keys = mongoUser.CreateWireguardKeys();
  fs.writeFileSync("/data/wireguardInterface.json", JSON.stringify(keys, null, 2));
  return keys;
}
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
  mongoUser.on(async ({operationType, fullDocument}) => {
    socket.emit("userOn", operationType, fullDocument);
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
});
