const crypto = require("crypto");
const Users = (() => {
  const RandomUsers = [];
  for (let req = 0; req < parseInt(process.env.REQUESTS||10); req++) RandomUsers.push(crypto.randomUUID().replace(/\-/gi, "").slice(0, 23));
  return RandomUsers;
})();

require("./users/v3/index").main(Users);