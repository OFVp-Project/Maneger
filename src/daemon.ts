import http from "http";
import socketIO from "socket.io";
import * as UserMongo from "./model/users";
import * as WireguardIpmaneger from "./WireguardIpmaneger";
import * as PasswordEncrypt from "./PasswordEncrypt";

export const httpServer = http.createServer();
const io = new socketIO.Server(httpServer, {transports: ["websocket", "polling"]});

io.use((socket, next) => {
  const { DAEMON_PASSWORD="", DAEMON_USER="" } = process.env;
  if (socket.handshake.auth.password !== DAEMON_PASSWORD) return next(new Error("Wrong password"));
  if (socket.handshake.auth.username !== DAEMON_USER) return next(new Error("Wrong username"));
  next();
});

async function wireguardSend() {
  const users = await UserMongo.getUsers();
  const keys = await UserMongo.wireguardInterfaceConfig();
  const ips = await WireguardIpmaneger.getWireguardip();
  return {
    users: users,
    WireguardIpConfig: {
      keys: keys,
      ip: ips
    }
  };
};

io.on("connection", async socket => {
  const wireguardConfig = await wireguardSend();
  const decryptUsers = await UserMongo.getUsersDecrypt();
  socket.emit("wireguard", wireguardConfig);
  socket.emit("users", decryptUsers);
});
UserMongo.on(async ({operationType, fullDocument}) => {
  if (typeof fullDocument.password !== "string") fullDocument.password = PasswordEncrypt.DecryptPassword(fullDocument.password);
  io.emit("userUpdate", operationType, fullDocument);
  io.emit("wireguard", await wireguardSend());
  io.emit("users", await UserMongo.getUsersDecrypt());
});
