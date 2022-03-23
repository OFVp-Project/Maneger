#!/usr/bin/env node
/* const Console = require("console");
global.console = new Console.Console({
  stdout: process.stdout,
  stderr: process.stderr,
  colorMode: true,
  ignoreErrors: true,
  groupIndentation: 2
}); */
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

(async ()=> {
  console.log("Connecting in mongo database");
  await (require("./mongo/connect")).ConnectionStatus();
  console.log("Sucess to connect in database");
  require("./daemon");
  require("./api/index");
})();
