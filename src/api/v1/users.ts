import * as express from "express";
import * as qrCode from "qrcode";
import * as js_yaml from "js-yaml";
import { promisify } from "util";
import { registersUser, findOne, getUsers, getWireguardconfig, deleteUser } from "../../model/users";
export const app = express.Router();
const qrCodeCreate = promisify(qrCode.toBuffer);

app.get("/Users/:User", async (req, res) => res.json(await findOne(req.params.User)));
app.route("/").get(async ({res}) => res.json(await getUsers())).post(async (req, res) => {
  if (req.body === undefined||Object.keys(req.body).length === 0) return res.json({message: "Invalid body"});
  const { username, password, date_to_expire, ssh_connections, wireguard_peers } = req.body as {username: string; password: string; date_to_expire: string; ssh_connections: number|string; wireguard_peers: number|string;};
  const ErrorInputs = [];
  if (!username) ErrorInputs.push({parameter: "username", message: "Username is required"});
  if (!password) ErrorInputs.push({parameter: "password", message: "Password is required"});
  if (!date_to_expire) ErrorInputs.push({parameter: "date_to_expire", message: "Date to expire is required"});
  if (date_to_expire) {
    const UserDate = new Date(date_to_expire);
    const futureDate = new Date(new Date().getTime() + (1000 * 60 * 60 * 24 * 2));
    if (UserDate.toString() === "Invalid Date") ErrorInputs.push({parameter: "date_to_expire", message: "Date to expire is invalid, please use YYYY-MM-DD or javascript Date object"});
    else if (UserDate.getTime() <= futureDate.getTime()) ErrorInputs.push({parameter: "date_to_expire", message: "Date to expire is in the future, date input: "+UserDate.toString()+", min require date: "+futureDate.toString()});
  }
  if (parseInt(String(ssh_connections)) !== 0) {if (isNaN(parseInt(String(ssh_connections)))) ErrorInputs.push({parameter: "ssh_connections", message: "Ssh connections is required"});}
  if (parseInt(String(wireguard_peers)) !== 0) {if (isNaN(parseInt(String(wireguard_peers)))) ErrorInputs.push({parameter: "wireguard_peers", message: "Count to get keys and ips to wireguard"});}
  if (typeof username !== "string") return res.status(400).json({message: "Username no is string"});
  if (username.trim().toLowerCase() === "root") return res.status(400).json({message: "not allowed to root username"});
  if (ErrorInputs.length > 0) return res.status(400).json({ error: ErrorInputs });
  if (await findOne(username)) return res.status(400).json({ error: "User already exists" });
  const userDateRegisted = await registersUser({
    username: username,
    password: password,
    expire: (new Date(date_to_expire)),
    ssh_connections: parseInt(String(ssh_connections)),
    wireguard_peers: parseInt(String(wireguard_peers))
  });
  return res.json(userDateRegisted);
});

app.post("/delete", async (req, res) => {
  await deleteUser(req.body.username);
  return res.json({message: "Success to remove"});
});

app.get("/Wireguard/:Type/:User", async (req, res) => {
  const { Type, User } = req.params;
  const wirepeerindex = parseInt(String(req.query.peer)||"0");
  const endpoint = process.env.WIREGUARD_HOST||String(req.query.host||req.headers.host||req.headers.Host||req.headers.hostname||req.headers.Hostname||"").replace(/\:.*/, "");
  const Port = parseInt(process.env.WIREGUARD_PORT||"51820");
  const ConfigUserInJson = await getWireguardconfig(User, wirepeerindex, endpoint, Port);
  const newInterface = ConfigUserInJson.Interface.Address.map(Ip => `${Ip.ip}/${Ip.mask}`)
  try {
    // Create Client Config
    if (Type === "wireguard"||Type === "qrcode") {
      const WireguardConfig = ([
        "[Interface]",
        `PrivateKey = ${ConfigUserInJson.Interface.PrivateKey}`,
        `Address = ${newInterface.join(",")}`,
        `DNS = ${ConfigUserInJson.Interface.DNS.join(",")}`,
        "",
        "[Peer]",
        `PublicKey = ${ConfigUserInJson.Peer.PublicKey}`,
        `PresharedKey = ${ConfigUserInJson.Peer.PresharedKey}`,
        `Endpoint = ${ConfigUserInJson.Peer.Endpoint}:${ConfigUserInJson.Peer.Port}`,
        `AllowedIPs = ${ConfigUserInJson.Peer.AllowedIPs.join(",")}`
      ]).join("\n");
      if (Type === "qrcode") {
        res.setHeader("Content-Type", "image/png");
        return res.send(await qrCodeCreate(WireguardConfig, { type: "png" }));
      }
      res.setHeader("Content-Type", "text/plain");
      return res.send(WireguardConfig);
    }
    else if (Type === "json") return res.json(ConfigUserInJson);
    else if (Type === "yaml") {
      res.setHeader("Content-Type", "text/yaml");
      return res.send(js_yaml.dump(ConfigUserInJson));
    }
    else if (Type === "openwrt18") {
      const RandomInterfaceName = Math.random().toString(36).substring(2, 15).slice(0, 8);
      res.setHeader("Content-Type", "text/plain");
      return res.send(([
        `config interface '${RandomInterfaceName}'`,
        `  option proto 'wireguard'`,
        `  option private_key '${ConfigUserInJson.Interface.PrivateKey}'`,
        ...newInterface.map(Address => `  list addresses '${Address}'`),
        "",
        `config wireguard_${RandomInterfaceName}`,
        `  option description '${RandomInterfaceName}Peer'`,
        `  option public_key '${ConfigUserInJson.Peer.PublicKey}'`,
        `  option preshared_key '${ConfigUserInJson.Peer.PresharedKey}'`,
        ...ConfigUserInJson.Peer.AllowedIPs.map(IP => `  list allowed_ips '${IP}'`),
        `  option endpoint_host '${ConfigUserInJson.Peer.Endpoint}'`,
        `  option endpoint_port '${ConfigUserInJson.Peer.Port}'`,
        "  option persistent_keepalive '25'",
        "  option route_allowed_ips '1'"
      ]).join("\n"));
    }
    return res.status(400).json({ error: "Valid: wireguard, qrcode, openwrt18, json, yaml" });
  } catch (err) {
    return res.status(400).json({ error: String(err.stack||err).split(/\r\n|\n/gi) });
  }
});
