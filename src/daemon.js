const http = require("http");
const socketIO = require("socket.io");
const fs = require("fs");
const path = require("path");
const UserMongo = require("./mongo/Schemas/users");
const WireguardIpmaneger = require("./WireguardIpmaneger");
const PasswordEncrypt = require("./PasswordEncrypt");

const WireguardKeys = () => {
  const storage = (process.env.NODE_ENV === "development"||process.env.NODE_ENV === "testing")? process.cwd():"/data";
  if (fs.existsSync(path.resolve(storage, "wireguardInterface.json"))) return JSON.parse(fs.readFileSync(path.resolve(storage, "wireguardInterface.json"), "utf8"));
  const keys = UserMongo.CreateWireguardKeys();
  fs.writeFileSync(path.resolve(storage, "wireguardInterface.json"), JSON.stringify(keys, null, 2));
  return keys;
}

const httpServer = http.createServer();
const io = new socketIO.Server(httpServer);
httpServer.listen(5000, () => console.log("Daemon Listening on port 5000, dont expose to internet!"));
io.use((socket, next) => {
  const { DAEMON_PASSWORD="", DAEMON_USER="" } = process.env;
  if (socket.handshake.auth.password !== DAEMON_PASSWORD) return next(new Error("Wrong password"));
  if (socket.handshake.auth.username !== DAEMON_USER) return next(new Error("Wrong username"));
  next();
});

const wireguardSend = async () => ({
  users: await UserMongo.getUsers(),
  WireguardIpConfig: {
    keys: WireguardKeys(),
    ip: await WireguardIpmaneger.getWireguardip()
  }
});

io.on("connection", async socket => {
  socket.emit("wireguard", await wireguardSend());
  socket.emit("users", await UserMongo.getUsersDecrypt());
});
UserMongo.on(async ({operationType, fullDocument}) => {
  if (typeof fullDocument.password !== "string") fullDocument.password = PasswordEncrypt.DecryptPassword(fullDocument.password);
  io.emit("userUpdate", operationType, fullDocument);
  io.emit("wireguard", await wireguardSend());
  io.emit("users", await UserMongo.getUsersDecrypt());
});
