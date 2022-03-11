#!/usr/bin/env node
(async ()=> {
  console.log("Connecting in mongo database");
  await (require("./mongo/connect")).ConnectionStatus();
  console.log("Sucess to connect in database");
  const api = require("./api/index");
  api.Server.listen(3000, () => console.info("API listen in port 3000"));
})();