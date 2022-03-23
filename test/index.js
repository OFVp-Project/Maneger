const crypto = require("crypto");
(() => {
  const RandomUsers = [];
  for (let req = 0; req < parseInt(process.env.REQUESTS||5); req++) {
    let idAdd = crypto.randomUUID().replace(/\-/gi, "").slice(0, 23);
    console.log("Testing with username:", idAdd);
    RandomUsers.push(require("./users/v1").main(idAdd).catch(err => {
      console.log(err);
      process.exit(1);
    }));
  }
})();