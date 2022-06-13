#!/usr/bin/env node
// Imports
import * as API from "./api/index";
import * as MongoConnect from "./mongo";
import * as daemon from "./daemon";

console.log("Connecting in mongo database");
MongoConnect.ConnectionStatus().then(() => console.log("Sucess to connect in database"))
// Listen fist daemon for all servers maneger
.then(() => new Promise<void>(resolve => daemon.Server.listen(5000, resolve))).then(() => console.log("Daemon listen in port 5000"))
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