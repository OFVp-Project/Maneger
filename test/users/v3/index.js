const crypto = require("crypto");
const http_requests = require("../../http_request");
const reqNumber = 10;

(async function(){
  // Add user
  console.log("Adding user");
  const Users = [];
  for (let usersRes of (() => {const requests = [];for (let req = 0; req < reqNumber; req++) {requests.push(http_requests.postBuffer("http://localhost:3000/users/v3", {username: crypto.randomUUID().replace(/\-/gi, "").slice(0, 23), password: "aaaaaaaa14", date_to_expire: new Date((new Date().getTime()+(1000*60*60*7*30*2))).toString(), ssh_connections: 0, wireguard_peers: 1}).then(res => JSON.parse(res.data.toString("utf8"))));};return requests;})()) Users.push(await usersRes);
  console.log(Users);

  // Get List
  console.log("Geting Users");
  console.log(JSON.stringify((await http_requests.getBuffer("http://localhost:3000/users/v3")).toString("utf8")));

  // Get Wireguard Config
  console.log("Get Wireguard Configs");
  const wireguardConfig = await (async() => {
    let tmp = [];
    for (const tmp2 of Users.map(async User => ({
      json: await http_requests.getBuffer(`http://localhost:3000/users/v3/Wireguard/json/${User.username}`),
      yaml: await http_requests.getBuffer(`http://localhost:3000/users/v3/Wireguard/yaml/${User.username}`),
      wireguard: await http_requests.getBuffer(`http://localhost:3000/users/v3/Wireguard/wireguard/${User.username}`),
      openwrt_18: await http_requests.getBuffer(`http://localhost:3000/users/v3/Wireguard/openwrt18/${User.username}`)
    }))) tmp.push(await tmp2);
    return tmp;
  })();
  console.log(wireguardConfig);

  // Delete User
  Users.map(User => http_requests.postBuffer("http://localhost:3000/users/v3/delete", {
    username: User.username
  }));
})().catch(err => {
  console.log(err);
  if (err.data) {
    console.log(err.data.toString())
  }
  process.exit(1);
});