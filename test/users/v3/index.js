const http_requests = require("../../http_request");
(async function(){
  // Add user
  console.log("Adding user");
  console.log((await http_requests.postBuffer("http://localhost:3000/users/v3", {
    username: "dev12_test",
    password: "aaaaaaaa14",
    date_to_expire: new Date((new Date().getTime()+(1000*60*60*7*30*2))).toString(),
    ssh_connections: 0,
    wireguard_peers: 1
  })).toString());

  // Get List
  console.log("Geting Users");
  console.log((await http_requests.getBuffer("http://localhost:3000/users/v3")).toString());

  // Get Wireguard Config
  console.log("Get Wireguard Configs");
  console.log((await http_requests.getBuffer("http://localhost:3000/users/v3/Wireguard/json/dev12_test")).toString());
  console.log((await http_requests.getBuffer("http://localhost:3000/users/v3/Wireguard/yaml/dev12_test")).toString());
  console.log((await http_requests.getBuffer("http://localhost:3000/users/v3/Wireguard/wireguard/dev12_test")).toString());
  console.log((await http_requests.getBuffer("http://localhost:3000/users/v3/Wireguard/openwrt18/dev12_test")).toString());

  // Delete User
  const Post_delete = await http_requests.postBuffer("http://localhost:3000/users/v3/delete", {
    username: "dev12_test"
  });
})().catch(err => {
  console.log(err);
  if (err.data) {
    console.log(err.data.toString())
  }
  process.exit(1);
});