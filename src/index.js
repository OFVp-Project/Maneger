#!/usr/bin/env node
/* const Console = require("console");
global.console = new Console.Console({
  stdout: process.stdout,
  stderr: process.stderr,
  colorMode: true,
  ignoreErrors: true,
  groupIndentation: 2
}); */
(async ()=> {
  console.log("Connecting in mongo database");
  await (require("./mongo/connect")).ConnectionStatus();
  console.log("Sucess to connect in database");
  require("./daemon");
  require("./api/index");
})();
