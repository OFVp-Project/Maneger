const crypto = require("crypto");
(async () => {
  for (let req = 0; req < parseInt(process.env.REQUESTS||5); req++) await (require("./users/v1")).main(crypto.randomUUID().replace(/\-/gi, "").slice(0, 23));
})();