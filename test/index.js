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
const showTime = () => {
  let EndDate = (new Date()).getTime() - InitDate.getTime();
  console.log("Users test took:");
  for (const Dat of [{name: "seconds", value: 1000, correct_value: 60}, {name: "minutes", value: 60, correct_value: 60}, {name: "hours", value: 60, correct_value: 60}, {name: "days", value: 24, correct_value: 24}, {name: "weeks", value: 7, correct_value: 7}, {name: "months", value: 30, correct_value: 30}, {name: "years", value: 12, correct_value: 12}]) {
    if (EndDate <= Dat.value) break
    EndDate = EndDate / Dat.value;
    console.log(Dat.name+":", Math.floor(EndDate % Dat.correct_value));
  }
}
require("./users/v3").main(Users).then(showTime).catch(err => {
  console.log(err);
  showTime();
  process.exit(1);
});