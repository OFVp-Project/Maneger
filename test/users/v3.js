const http_requests = require("../http_request");

async function CreateRequest(Username){
  const User = await http_requests.postBuffer(`${process.env.DAEMON_HOST||"http://localhost:3000"}/users/v3`, {
    username: Username,
    password: "aaaaaaaa14",
    date_to_expire: new Date((new Date().getTime()+(1000*60*60*7*30*2))).toString(),
    ssh_connections: 0,
    wireguard_peers: 1
  }).then(res => JSON.parse(res.data.toString("utf8")));
  return User;
}

async function getWireguardConfig(username) {
  const data = await Promise.all([
    await http_requests.getBuffer(`${process.env.DAEMON_HOST||"http://localhost:3000"}/users/v3/Wireguard/json/${username}`),
    await http_requests.getBuffer(`${process.env.DAEMON_HOST||"http://localhost:3000"}/users/v3/Wireguard/yaml/${username}`),
    await http_requests.getBuffer(`${process.env.DAEMON_HOST||"http://localhost:3000"}/users/v3/Wireguard/wireguard/${username}`),
    await http_requests.getBuffer(`${process.env.DAEMON_HOST||"http://localhost:3000"}/users/v3/Wireguard/openwrt18/${username}`)
  ]);
  return {
    json: data[0].data.toString("utf8"),
    yaml: data[1].data.toString("utf8"),
    wireguard: data[2].data.toString("utf8"),
    openwrt18: data[3].data.toString("utf8")
  };
}

async function deleteuser(username) {
  await http_requests.postBuffer(`${process.env.DAEMON_HOST||"http://localhost:3000"}/users/v3/delete`, {username: username});
}

/**
 * @param {Array<string>} Users 
 * @returns {Promise<any>}
 */
module.exports.main = Users => Promise.all(Users.map(async randomUsername => {
  const dataCreate = await CreateRequest(randomUsername);
  const wireguardConfig = await getWireguardConfig(randomUsername);
  await deleteuser(randomUsername);
  return {data: dataCreate, wireguardConfig: wireguardConfig};
}));
