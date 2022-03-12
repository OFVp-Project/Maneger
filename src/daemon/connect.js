const { createServer } = require("http");
const SocketIo = require("socket.io");

// Create http server and Socket.io
const Server = createServer();
Server.listen(5000, () => console.log("Daemon listen in port 5000, dont expose to internet!"));
const io = new SocketIo.Server(Server);
io.use((socket, next) => {
  const { PASSWORD, USER } = socket.handshake.auth;
  const { DAEMON_PASSWORD, DAEMON_USER } = process.env;
  if (DAEMON_PASSWORD === undefined || DAEMON_USER === undefined) return next();
  if (!DAEMON_PASSWORD || !DAEMON_USER) return next();
  if (DAEMON_PASSWORD === PASSWORD && DAEMON_USER === USER) return next();
  console.error(`Failed auth to daemon socket.io id: ${socket.id}`);
  return next(new Error("Auth failed"));
});
io.on("connection", socket => console.log(`daemon Socket.io connect id: ${socket.id}`));

// Export socket.io
module.exports.io = io;
