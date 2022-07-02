import * as path from "node:path";
import * as fs from "node:fs";
import * as net from "node:net";
import * as os from "node:os";
import event from "node:events";
import { parsePayload } from './lib/payload';
const pathSock = path.resolve(process.env.SOCKETFOLDER||os.tmpdir(), "ofvp_daemon.sock");

declare interface DameonEvent {
  /** Authencation status */

  emit(act: "connection", connected: "ok"|"fail", connection: {ip?: string, port?: number, socket: net.Socket}): boolean;
  /** Authencation status */
  once(act: "connection", fn: (connected: "ok"|"fail", connection: {ip?: string, port?: number, socket: net.Socket}) => void): this;
  /** Authencation status */
  on(act: "connection", fn: (connected: "ok"|"fail", connection: {ip?: string, port?: number, socket: net.Socket}) => void): this;

  emit(act: "userRequest", callback: (...any) => void): boolean;
  once(act: "userRequest", fn: (callback: (...any) => void) => void): this;
  on(act: "userRequest", fn: (callback: (...any) => void) => void): this;

  emit(act: "wireguardRequest", callback: (...any) => void): boolean;
  once(act: "wireguardRequest", fn: (callback: (...any) => void) => void): this;
  on(act: "wireguardRequest", fn: (callback: (...any) => void) => void): this;

  /** Error listening */
  on(act: "error", fn: (err: Error) => void): this;
  emit(act: "error", err: Error): boolean;
}
class DameonEvent extends event {}
export const Daemon = new DameonEvent();
Daemon.on("error", (err: Error) => console.log(err));

export type requestObject = {
  require: "userRequest"|"wireguardRequest",
  id: string,
  body?: any
}
Daemon.on("connection", (status, info) => {
  if (status === "fail") return;
  info.socket.on("data", data => {
    console.log(data.toString("utf8"))
    try {
      const dtaBuf = JSON.parse(data.toString("utf8")) as requestObject;
      if (dtaBuf.require === "userRequest") {
        let isRes = false;
        Daemon.emit("userRequest", function(data) {
          if (isRes) return console.log("Data is send");
          info.socket.write(JSON.stringify({
            data: Buffer.from(JSON.stringify(data)).toString("base64"),
            id: dtaBuf.id
          }));
        });
      }
    } catch (err) {
      Daemon.emit("error", err);
    }
  });
});

/*
Create Unix Socket to local server
This is the simplest way to create an interface between servers
This is an implementation with simpler coding of connections between local servers and more secure because it does not depend on creating a network interface!
*/
const unixSocket = net.createServer();
unixSocket.on("connection", connection => {
  console.log("new Connection from unix Socket");
  return Daemon.emit("connection", "ok", {socket: connection});
});

/*
Create TCP Server and listen on 5000 Port
This is an implementation to keep a Socket.io base as a base example
*/
const tcpSocket = net.createServer();
const { DAEMON_USERNAME, DAEMON_PASSWORD } = process.env;
tcpSocket.on("connection", async connection => {
  console.log("new Connection from %s", connection.localAddress+":"+connection.localPort);
  const payload = parsePayload(await new Promise(res => connection.once("data", res)));
  if (!!DAEMON_USERNAME && !!DAEMON_PASSWORD) {
    const connUser = payload.headers.Username || payload.headers.username;
    const connPass = payload.headers.Password || payload.headers.password;
    if (connUser !== DAEMON_USERNAME) {
      connection.write("Fail auth username");
      return Daemon.emit("connection", "fail", {
        ip: connection.localAddress,
        port: connection.localPort,
        socket: connection
      });
    }
    else if (connPass !== DAEMON_PASSWORD) {
      connection.write("Fail auth password");
      return Daemon.emit("connection", "fail", {
        ip: connection.localAddress,
        port: connection.localPort,
        socket: connection
      });
    }
  }
  return Daemon.emit("connection", "ok", {
    ip: connection.localAddress,
    port: connection.localPort,
    socket: connection
  });
});

listen()
export async function listen() {
  if (fs.existsSync(pathSock)) await fs.promises.rm(pathSock, {force: true});
  unixSocket.on("close", () => {
    if (!(fs.existsSync(pathSock))) return Promise.resolve();
    return fs.promises.rm(pathSock, {force: true})
  });
  unixSocket.listen(pathSock, () => console.log("Daemon Socket listening in path '%s'", pathSock));
  tcpSocket.listen(5000, "0.0.0.0", () => console.log("Daemon TCP listen on %f port", 5000))
}