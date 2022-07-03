#!/usr/bin/env node
// Check environments and import modules
import "./consoleLogColor";
import * as API from "./api/index";
import * as MongoConnect from "./mongo";
import * as daemon from "./daemon";

// Extends Process envs
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      /** Don't show color on Log Terminal */
      NOCOLOR: "0"|"1",
      /** Set API to production or development */
      NODE_ENV?: "development" | "test" | "production",
      /** Secret to encrypt passwords */
      PASSWORD_SECERET: string,
      /**
       * Mongo Server url connection
       * @deprecated Use MONGO_URL
       */
      MongoDB_URL: string,
      /** Mongo Server url connection */
      MONGO_URL: string,
      /** Cookie Secret to encrypt cookies */
      COOKIE_SECRET: string,
      /** Show daemon log */
      SHOWDAEMONLOG: string,
      /** Daemon Username to Auth, Black not auth required */
      DAEMON_USERNAME?: string,
      /** Daemon Password to Auth, Black not auth required */
      DAEMON_PASSWORD?: string,
      /** Wireguard Host */
      WIREGUARD_HOST?: string,
      /** Wireguard Port */
      WIREGUARD_PORT?: string,
      /** SSH Host */
      SSH_HOST?: string,
      /** SSH Port */
      SSH_PORT?: string,
    }
  }
}

console.log("Connecting in mongo database");
MongoConnect.ConnectionStatus().then(() => console.log("Sucess to connect in database"))
// Listen fist daemon for all servers maneger
.then(() => new Promise<void>(resolve => daemon.Server.listen(5000, resolve))).then(() => console.log("Daemon Socket.io listen in port 5001"))
// Listen API for users
.then(() => new Promise<void>(resolve => API.Server.listen(3000, resolve))).then(() => console.info("API listen in port 3000"))
// Show is OK in console
.then(() => console.log("All Services is UP"))
// Catch All Erros in Mongo Connection, Daemon and API for show in console if is a error
.catch(err => {
  console.log("Detected Error On Start Basic Services, Error:\n%o", err);
  console.log("Exiting main process with code 1");
  process.exit(1);
});