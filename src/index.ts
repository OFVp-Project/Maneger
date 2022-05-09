#!/usr/bin/env node
// Set Default envs
if (!process.env.MongoDB_URL) process.env.MongoDB_URL = "mongodb://localhost/OFVpServer";
if (!process.env.NODE_ENV) process.env.NODE_ENV = "development";
if (!process.env.COOKIE_SECRET) process.env.COOKIE_SECRET = "dev";
if (!process.env.PASSWORD_ENCRYPT) process.env.PASSWORD_ENCRYPT = "dev";
if (!process.env.DAEMON_PASSWORD) process.env.DAEMON_PASSWORD = "";
if (!process.env.DAEMON_USER) process.env.DAEMON_USER = "";
if (!process.env.WIREGUARD_HOST) process.env.WIREGUARD_HOST = "";
if (!process.env.WIREGUARD_PORT) process.env.WIREGUARD_PORT = "";
if (!process.env.OPENSSH_HOST) process.env.OPENSSH_HOST = "";
if (!process.env.OPENSSH_PORT) process.env.OPENSSH_PORT = "";
import * as API from "./api/index";
import * as MongoConnect from "./mongo";

(async ()=> {
  console.log("Connecting in mongo database");
  await MongoConnect.ConnectionStatus().then(() => console.log("Sucess to connect in database"));
  API.Server.listen(3000, () => console.info("API listen in port 3000"));
  API.Daemon.listen(5000, () => console.log("Daemon Listening on port 5000, dont expose to internet!"));
})();
