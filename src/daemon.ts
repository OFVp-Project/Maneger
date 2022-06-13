import * as socket_io from "socket.io";
import * as http from "node:http";
import * as wireguard from "./schemas/Wireguard";
import * as ssh from "./schemas/ssh";

const { DAEMON_USERNAME, DAEMON_PASSWORD } = process.env;
export const Server = http.createServer();
export const io = new socket_io.Server(Server, {transports: ["websocket", "polling"], cors: {origin: "*"}});
if (!DAEMON_USERNAME && !DAEMON_PASSWORD) console.info("[Daemon] the Daemon will not authenticate");
else {
  io.use((socket, next) => {
    const connUser = socket.handshake.query.username || socket.handshake.auth.username || socket.handshake.headers.username;
    const connPass = socket.handshake.query.password || socket.handshake.auth.password || socket.handshake.headers.password;
    if (connUser !== DAEMON_USERNAME) return next(new Error("Authentication Error: Username is not valid"));
    else if (connPass !== DAEMON_PASSWORD) return next(new Error("Authentication Error: Password is not valid"));
    return next();
  });
}

io.on("connection", (socket) => {
  // Wireguard
  // Send Wireguard Config on Request
  socket.on("wireguardServerConfig", () => {
    console.log("[Daemon]  Requested Wireguard Server Config");
    return wireguard.wireguardInterfaceConfig().then(data => socket.emit("wireguardServerConfig", data));
  });
  // Send Wireguard users on request
  socket.on("wireguardUsers", () => {
    console.log("[Daemon]  Requested Wireguard Users");
    return wireguard.getUsers().then(data => socket.emit("wireguardUsers", data));
  });

  // OpenSSH
  // Send OpenSSH users on request
  socket.on("opensshUsers", () => {
    console.log("[Daemon] Requested OpenSSH Users (Passwords is encrypted)");
    return ssh.getUsers().then(data => socket.emit("opensshUsers", data));
  });
});