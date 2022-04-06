import http from "http";
import socketIO from "socket.io";
import * as UserMongo from "./model/users";
import * as WireguardIpmaneger from "./WireguardIpmaneger";
import * as PasswordEncrypt from "./PasswordEncrypt";

export const httpServer = http.createServer();
const io = new socketIO.Server(httpServer, {
  transports: ["websocket", "polling"]
});

io.use((socket, next) => {
  const { DAEMON_PASSWORD="", DAEMON_USER="" } = process.env;
  if (socket.handshake.auth.password !== DAEMON_PASSWORD) return next(new Error("Wrong password"));
  if (socket.handshake.auth.username !== DAEMON_USER) return next(new Error("Wrong username"));
  next();
});

const wireguardSend = async () => ({
  users: await UserMongo.getUsers(),
  WireguardIpConfig: {
    keys: UserMongo.wireguardInterfaceConfig(),
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
