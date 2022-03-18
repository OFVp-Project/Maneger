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
  await Promise.all([
    await http_requests.getBuffer(`http://localhost:3000/users/v3/Wireguard/json/${User.username}`),
    await http_requests.getBuffer(`http://localhost:3000/users/v3/Wireguard/yaml/${User.username}`),
    await http_requests.getBuffer(`http://localhost:3000/users/v3/Wireguard/wireguard/${User.username}`),
    await http_requests.getBuffer(`http://localhost:3000/users/v3/Wireguard/openwrt18/${User.username}`)
  ]);
  await http_requests.postBuffer("http://localhost:3000/users/v3/delete", {username: User.username});
  console.log("Passing:", User.username);
}

/**
 * @param {Array<string>} Users 
 * @returns {Promise<any>}
 */
module.exports.main = Users => Users.map(data => CreateRequest(data));