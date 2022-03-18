const crypto = require("crypto");
const Users = (() => {
  const RandomUsers = [];
  for (let req = 0; req < parseInt(process.env.REQUESTS||5); req++) {
    let idAdd = crypto.randomUUID().replace(/\-/gi, "").slice(0, 23);
    console.log("Testing with username:", idAdd);
    RandomUsers.push(idAdd);
  }
  return RandomUsers;
})();

require("./users/v3").main(Users);