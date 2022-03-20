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
const InitDate = new Date();
require("./users/v3").main(Users).then(() => {
  let EndDate = (new Date() - InitDate) / 1000;
  console.log("Users test took:");
  const DatesCal = [{name: "seconds", value: 1000, correct_value: 60}, {name: "minutes", value: 60, correct_value: 60}, {name: "hours", value: 60, correct_value: 60}, {name: "days", value: 24, correct_value: 24}, {name: "weeks", value: 7, correct_value: 7}, {name: "months", value: 30, correct_value: 30}, {name: "years", value: 12, correct_value: 12}];
  console.log("microseconds:", (EndDate / 1000) % 1);
  for (const Dat of DatesCal) {
    if (EndDate <= Dat.value) break
    EndDate = EndDate / Dat.value;
    console.log(Dat.name+":", Math.floor(EndDate % Dat.correct_value));
  }
});