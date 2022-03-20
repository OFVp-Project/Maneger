const http_requests = require("../http_request");

async function CreateRequest(Username){
  const User = await http_requests.postBuffer(`${process.env.DAEMON_HOST||"http://localhost:3000"}/users/v3`, {
    username: Username,
    password: "aaaaaaaa14",
    date_to_expire: new Date((new Date().getTime()+(1000*60*60*7*30*2))).toString(),
    ssh_connections: 0,
    wireguard_peers: 1
  }).then(res => JSON.parse(res.data.toString("utf8")));
  await Promise.all([
    await http_requests.getBuffer(`${process.env.DAEMON_HOST||"http://localhost:3000"}/users/v3/Wireguard/json/${User.username}`),
    await http_requests.getBuffer(`${process.env.DAEMON_HOST||"http://localhost:3000"}/users/v3/Wireguard/yaml/${User.username}`),
    await http_requests.getBuffer(`${process.env.DAEMON_HOST||"http://localhost:3000"}/users/v3/Wireguard/wireguard/${User.username}`),
    await http_requests.getBuffer(`${process.env.DAEMON_HOST||"http://localhost:3000"}/users/v3/Wireguard/openwrt18/${User.username}`)
  ]);
  await http_requests.postBuffer(`${process.env.DAEMON_HOST||"http://localhost:3000"}/users/v3/delete`, {username: User.username});
  return User;
}

/**
 * @param {Array<string>} Users 
 * @returns {Promise<any>}
 */
module.exports.main = Users => Promise.all(Users.map(data => CreateRequest(data)));