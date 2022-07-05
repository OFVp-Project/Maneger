import * as fs from "node:fs";
import * as net from "node:net";
import * as event from "node:events";
import * as payload from "../payload";
import * as userID from "../../schemas/UserID";
import * as Wireguard from "../../schemas/Wireguard";
import * as ssh from "../../schemas/ssh";

export type fromConnection = "socket"|"tcp";
export declare interface createServer {
  emit(act: "connected", data: {socket: net.Socket, from: fromConnection, ip_port?: string}): boolean;
  once(act: "connected", fn: (data: {socket: net.Socket, from: fromConnection, ip_port?: string}) => void): this;
  on(act: "connected", fn: (data: {socket: net.Socket, from: fromConnection, ip_port?: string}) => void): this;

  emit(act: "disconnected", data: {socket: net.Socket, from: fromConnection, ip_port?: string}): boolean;
  once(act: "disconnected", fn: (data: {socket: net.Socket, from: fromConnection, ip_port?: string}) => void): this;
  on(act: "disconnected", fn: (data: {socket: net.Socket, from: fromConnection, ip_port?: string}) => void): this;
}

export class createServer extends event.EventEmitter {
  private tcpServer: net.Server = net.createServer();
  private socketServer: net.Server = net.createServer();
  constructor (socketListen: string, portListen: number, Auth?: {username: string, password: string}) {
    super({captureRejections: false});
    this.tcpServer.on("connection", async socket => {
      // Recive Payload to auth if set auths
      const payloadRes = payload.parsePayload(await new Promise<Buffer>(res => socket.once("data", res)));
      const { auth_username, auth_password } = payloadRes.headers;
      if (!!Auth?.username && !!Auth?.password) {
        if (Auth.username !== auth_username) return socket.end(`HTTP/1.0 400 Auth Failed\r\n\r\n`);
        else if (Auth.password !== auth_password) return socket.end(`HTTP/1.0 400 Auth Failed\r\n\r\n`);
      }
      socket.write(`HTTP 200 Auth Sucess\r\n\r\n`);
      socket.on("close", () => this.emit("disconnected", {from: "tcp", socket: socket, ip_port: `${socket.localAddress}:${socket.localPort}`}));
      listenOns(socket, this);
      return this.emit("connected", {from: "tcp", socket: socket, ip_port: `${socket.localAddress}:${socket.localPort}`});
    });
    this.socketServer.on("connection", async socket => {
      console.log(payload.parsePayload(await new Promise<Buffer>(res => socket.once("data", res)))); // TODO: Remover depois das depuração e testes, apenas para capturar a payload.
      socket.write(`HTTP 200 Auth Sucess\r\n\r\n`);
      socket.on("close", () => this.emit("disconnected", {from: "socket", socket: socket}));
      listenOns(socket, this);
      return this.emit("connected", {from: "socket", socket: socket});
    });
    this.tcpServer.listen(portListen, () => console.log("Daemon TCP Listen on %f", portListen));
    if (fs.existsSync(socketListen)) fs.rmSync(socketListen, {force: true});
    this.socketServer.listen(socketListen, () => console.log("Daemon unix Socket listen on '%s'", socketListen));
  }
}

function listenOns(connection: net.Socket, ee: createServer) {
  connection.on("data", async data => {
    const req = JSON.parse(Buffer.from(data.toString("utf8"), "hex").toString("utf8")) as {req: string, id: string, value: any};
    if (req.req === "Username") {
      const _User = await userID.findOne(req.value);
      const _Ssh = await ssh.sshSchema.findOne({UserID: _User.UserId}).lean();
      const _Wireguard = await Wireguard.findOne(_User.UserId);
      connection.write(Buffer.from(JSON.stringify({
        UserId: _User.UserId,
        Username: _User.Username,
        expireDate: _User.expireDate,
        SSH: {maxConnections: _Ssh?.maxConnections},
        Wireguard: _Wireguard||[]
      })).toString("hex"));
    }
  });
}