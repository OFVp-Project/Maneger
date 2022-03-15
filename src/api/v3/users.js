const express = require("express");
const app = express.Router();
module.exports.app = app;
const { wireguardInterfaceConfig } = require("../../daemon/connect");
const { getWireguardip } = require("../../mongo/v3/WireguardIpmaneger");
const qrCode = require("qrcode");
const js_yaml = require("js-yaml");
const { promisify } = require("util");
const qrCodeCreate = promisify(qrCode.toBuffer);

const mongoUser = require("../../mongo/v3/users");
app.get("/", async ({res}) => res.json(await mongoUser.getUsers()));
app.post("/delete", async (req, res) => {
  mongoUser.deleteUser(req.body.username);
  return res.json({
    message: "Success to remove",
    // data: user
  });
});
app.post("/", async (req, res) => {
  const { username, password, date_to_expire, ssh_connections, wireguard_peers } = req.body;
  const ErrorInputs = [];
  if (!username) ErrorInputs.push({
    parameter: "username",
    message: "Username is required"
  });
  if (!password) ErrorInputs.push({
    parameter: "password",
    message: "Password is required"
  });
  if (!date_to_expire) ErrorInputs.push({
    parameter: "date_to_expire",
    message: "Date to expire is required"
  });
  if (date_to_expire) {
    const UserDate = new Date(date_to_expire);
    const futureDate = new Date(new Date().getTime() + (1000 * 60 * 60 * 24 * 2));
    if (UserDate.toString() === "Invalid Date") ErrorInputs.push({
      parameter: "date_to_expire",
      message: "Date to expire is invalid, please use YYYY-MM-DD or javascript Date object"
    });
    else if (UserDate.getTime() <= futureDate.getTime()) ErrorInputs.push({
      parameter: "date_to_expire",
      message: "Date to expire is in the future, date input: "+UserDate.toString()+", min require date: "+futureDate.toString()
    });
  }
  if (parseInt(ssh_connections) !== 0) {
    if (isNaN(parseInt(ssh_connections))) ErrorInputs.push({
      parameter: "ssh_connections",
      message: "Ssh connections is required"
    });
  }
  if (parseInt(wireguard_peers) !== 0) {
    if (isNaN(parseInt(wireguard_peers))) ErrorInputs.push({
      parameter: "wireguard_peers",
      message: "Count to get keys and ips to wireguard"
    });
  }
  if (ErrorInputs.length > 0) return res.status(400).json({ error: ErrorInputs });
  if (username.trim() === "root") return res.status(400).json({
    message: "not allowed to root"
  });
  if (await mongoUser.findOne(username)) return res.status(400).json({ error: "User already exists" });
  return res.json(await mongoUser.registersUser({
    username: username,
    password: password,
    expire: (new Date(date_to_expire)),
    ssh_connections: parseInt(ssh_connections),
    wireguard_peers: parseInt(wireguard_peers)
  }));
});

app.get("/Wireguard/:Type/:User", async (req, res) => {
  const { Type, User } = req.params;
  const wirepeerindex = parseInt(req.query.peer||0);
  const endpoint = (req.query.host||req.headers.host||req.headers.Host||req.headers.hostname||req.headers.Hostname).replace(/\:.*/, "");
  const Client = await mongoUser.findOne(User);
  if (!Client) return res.status(400).json({ error: "User not found" });
  if (Client.wireguard.length === 0) return res.status(400).json({message: "No Wireguard keys!"});
  const ClientwireguardPeer = Client.wireguard[wirepeerindex];
  try {
    const WireguardServer = {
      ip: await getWireguardip(),
      keys: wireguardInterfaceConfig()
    }
    const ConfigUserInJson = {
      Interface: {
        PrivateKey: String(ClientwireguardPeer.keys.Private),
        Address: [
          `${ClientwireguardPeer.ip.v4.ip}/${ClientwireguardPeer.ip.v4.mask}`,
          `${ClientwireguardPeer.ip.v6.ip}/${ClientwireguardPeer.ip.v6.mask}`
        ],
        DNS: [
          "8.8.8.8",
          "1.1.1.1",
          "8.8.4.4",
          "1.0.0.1"
        ],
      },
      Peer: {
        PublicKey: String(WireguardServer.keys.Public),
        PresharedKey: String(ClientwireguardPeer.keys.Preshared),
        Endpoint: `${endpoint}:${req.query.port||"51820"}`,
        AllowedIPs: [
          "0.0.0.0/0",
          "::0/0"
        ]
      }
    };
    
    // Create Client Config
    if (Type === "wireguard"||Type === "qrcode") {
      const Config = ([
        "[Interface]",
        `PrivateKey = ${ConfigUserInJson.Interface.PrivateKey}`,
        `Address = ${ConfigUserInJson.Interface.Address.join(",")}`,
        `DNS = ${ConfigUserInJson.Interface.DNS.join(",")}`,
        "",
        "[Peer]",
        `PublicKey = ${ConfigUserInJson.Peer.PublicKey}`,
        `PresharedKey = ${ConfigUserInJson.Peer.PresharedKey}`,
        `Endpoint = ${endpoint}:51820`,
        `AllowedIPs = ${ConfigUserInJson.Peer.AllowedIPs.join(",")}`
      ]).join("\n");
      if (Type === "qrcode") {
        res.setHeader("Content-Type", "image/png");
        return res.send(await qrCodeCreate(Config, { type: "png" }));
      }
      res.setHeader("Content-Type", "text/plain");
      return res.send(Config);
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
        ...ConfigUserInJson.Interface.Address.map(Address => `  list addresses '${Address}'`),
        "",
        `config wireguard_${RandomInterfaceName}`,
        `  option description '${RandomInterfaceName}Peer'`,
        `  option public_key '${ConfigUserInJson.Peer.PublicKey}'`,
        `  option preshared_key '${ConfigUserInJson.Peer.PresharedKey}'`,
        ...ConfigUserInJson.Peer.AllowedIPs.map(IP => `  list allowed_ips '${IP}'`),
        `  option endpoint_host '${endpoint}'`,
        "  option endpoint_port '51820'",
        "  option persistent_keepalive '25'",
        "  option route_allowed_ips '1'"
      ]).join("\n"));
    }
    return res.status(400).json({ error: "Valid: wireguard, qrcode, openwrt18, json, yaml" });
  } catch (err) {
    return res.status(400).json({ error: String(err.stack||err).split(/\r\n|\n/gi) });
  }
});