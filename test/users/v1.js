const http_requests = require("../http_request");
async function CreateRequest(Username){
  const User = await http_requests.postBuffer(`${process.env.DAEMON_HOST||"http://localhost:3000"}/users/v1`, {
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
    await http_requests.getBuffer(`${process.env.DAEMON_HOST||"http://localhost:3000"}/users/v1/Wireguard/json/${username}`),
    await http_requests.getBuffer(`${process.env.DAEMON_HOST||"http://localhost:3000"}/users/v1/Wireguard/yaml/${username}`),
    await http_requests.getBuffer(`${process.env.DAEMON_HOST||"http://localhost:3000"}/users/v1/Wireguard/wireguard/${username}`),
    await http_requests.getBuffer(`${process.env.DAEMON_HOST||"http://localhost:3000"}/users/v1/Wireguard/openwrt18/${username}`)
  ]);
  return {
    json: data[0].data.toString("utf8"),
    yaml: data[1].data.toString("utf8"),
    wireguard: data[2].data.toString("utf8"),
    openwrt18: data[3].data.toString("utf8")
  };
}
async function deleteuser(username) {
  await http_requests.deleteBuffer(`${process.env.DAEMON_HOST||"http://localhost:3000"}/users/v1`, {username: username});
}

/**
 * @param {Array<string>} Users
 * @returns {Promise<any>}
 */
module.exports.main = async randomUsername => {
  const InitDate = new Date();
  const dataCreate = await CreateRequest(randomUsername);
  const wireguardConfig = await getWireguardConfig(randomUsername);
  if (process.env.DONT_DELETE !== "true") await deleteuser(randomUsername);
  let EndDate = (new Date()).getTime() - InitDate.getTime();
  console.log(randomUsername, "test took:");
  for (const Dat of [{name: "seconds", value: 1000, correct_value: 60}, {name: "minutes", value: 60, correct_value: 60}, {name: "hours", value: 60, correct_value: 60}, {name: "days", value: 24, correct_value: 24}, {name: "weeks", value: 7, correct_value: 7}, {name: "months", value: 30, correct_value: 30}, {name: "years", value: 12, correct_value: 12}]) {
    if (EndDate <= Dat.value) break
    EndDate = EndDate / Dat.value;
    console.log(Dat.name+":", Math.floor(EndDate % Dat.correct_value));
  }
  return {data: dataCreate, wireguardConfig: wireguardConfig};
};
