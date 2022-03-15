const crypto = require("crypto");
const http_requests = require("../../http_request");
const reqNumber = (process.env.REQUESTS||10);

async function CreateRequest(Username){
  console.log("Testing with username:", Username);
  const User = await http_requests.postBuffer("http://localhost:3000/users/v3", {
    username: Username,
    password: "aaaaaaaa14",
    date_to_expire: new Date((new Date().getTime()+(1000*60*60*7*30*2))).toString(),
    ssh_connections: 0,
    wireguard_peers: 1
  }).then(res => JSON.parse(res.data.toString("utf8")));
  const wireguardConfig = {
    json: (await http_requests.getBuffer(`http://localhost:3000/users/v3/Wireguard/json/${User.username}`)).data.toString(),
    yaml: (await http_requests.getBuffer(`http://localhost:3000/users/v3/Wireguard/yaml/${User.username}`)).data.toString(),
    wireguard: (await http_requests.getBuffer(`http://localhost:3000/users/v3/Wireguard/wireguard/${User.username}`)).data.toString(),
    openwrt_18: (await http_requests.getBuffer(`http://localhost:3000/users/v3/Wireguard/openwrt18/${User.username}`)).data.toString()
  };
  await http_requests.postBuffer("http://localhost:3000/users/v3/delete", {
    username: User.username
  });
  console.log("Passing:", User.username);
  console.log("Wireguard Config:", JSON.stringify(wireguardConfig, null, 2));
  console.log("Storage Config:", JSON.stringify(User));
}

(function(){
  for (let req = 0; req < reqNumber; req++) CreateRequest(crypto.randomUUID().replace(/\-/gi, "").slice(0, 23)).catch(err => {
    console.log(err);
    if (err.data) {
      console.log(err.data.toString())
    }
    process.exit(1);
  });
})();