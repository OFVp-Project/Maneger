import * as crypto from "node:crypto";
import * as net from "node:net";
import * as events from "node:events";
import * as payload from "../payload";

export declare interface connectDaemon {
  emit(act: "connect_failed"): boolean;
  on(act: "connect_failed", fn: () => void): this;
  once(act: "connect_failed", fn: () => void): this;
  emit(act: "ready"): boolean;
  once(act: "ready", fn: () => void): this;
  on(act: "ready", fn: () => void): this;
}

export class connectDaemon extends events.EventEmitter {
  private Connection?: net.Socket
  constructor(Connect: {Host: string, Port?: number}, Auth?: {username: string, password: string}) {
    super({captureRejections: false});
    if (!Connect.Port) this.Connection = net.createConnection({path: Connect.Host, allowHalfOpen: true});
    else this.Connection = net.createConnection({host: Connect.Host, port: Connect.Port, allowHalfOpen: true});

    if (!!Auth) this.Connection.on("ready", () => this.Connection.write(`GET / HTTP/1.1\r\nauth_username: ${Auth.username}\r\nauth_password: ${Auth.password}\r\n\r\n`));
    else this.Connection.on("ready", () => this.Connection.write(`GET / HTTP/1.1\r\n\r\n`));
    this.Connection.on("data", data => {
      const localPayload = payload.parsePayload(data);
      console.log(localPayload);
      if (localPayload.code !== 200) {
        this.Connection.end();
        this.emit("connect_failed");
        return;
      }
      this.emit("ready");
    });
  }
  findOneUser(Username: string) {
    const requestUid = crypto.pseudoRandomBytes(16).toString("hex");
    this.Connection.write(Buffer.from(JSON.stringify({
      request: "Username",
      value: Username,
      id: requestUid
    })).toString("hex"));
    return new Promise((res, rej) => {
      this.Connection.once("error", rej);
      const r = (data: Buffer) => {
        const req = JSON.parse(data.toString("utf8"));
        if (req.id === requestUid) return res({...req.value});
        return this.Connection.once("data", data => r(data));
      }
      this.Connection.once("data", data => r(data));
    });
  }
}