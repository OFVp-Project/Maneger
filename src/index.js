#!/usr/bin/env node
(async ()=> {
  console.log("Connecting in mongo database");
  await (require("./mongo/connect")).ConnectionStatus();
  console.log("Sucess to connect in database");
  require("./api/index");
})();