import * as express from "express";
import * as usersIDs from "../../schemas/UserID";
import * as Wireguard from "../../schemas/Wireguard";
import { promisify } from "util";
import * as yaml from "yaml";
import * as qrCode from "qrcode";
const qrCodeCreate = promisify(qrCode.toBuffer);
export const app = express.Router();

type wireguardDefine = {
  Interface: {
    PrivateKey: string;
    Address: Array<{ip: string; mask: string;}>
    DNS: Array<string>;
  };
  Peer: {
    PublicKey: string;
    PresharedKey: string;
    Endpoint: string;
    Port: number;
    AllowedIPs: Array<string>
  };
};

async function getWireguardconfig(Username: string, WireguardIndex: number = 0, host: string, port: number = 51820): Promise<wireguardDefine> {
  if (isNaN(WireguardIndex)) WireguardIndex = 0;
  const UserId = (await usersIDs.GetUsers()).find(user => user.Username === Username);
  if (!UserId) throw new Error("User not found");
  const wireguard = await Wireguard.findOne(UserId.UserId);
  if (!wireguard) throw new Error("Wireguard not found");
  const Interface = wireguard[WireguardIndex];
  if (!Interface) throw new Error("Wireguard not found");
  return {
    Interface: {
      PrivateKey: Interface.keys.Private,
      Address: [Interface.ip.v4, Interface.ip.v6],
      DNS: [
        "8.8.8.8",
        "1.1.1.1",
        "8.8.4.4",
        "1.0.0.1"
      ]
    },
    Peer: {
      PublicKey: Interface.keys.Public,
      PresharedKey: Interface.keys.Preshared,
      Endpoint: host,
      Port: Math.floor(port),
      AllowedIPs: [
        "0.0.0.0/0",
        "::0/0"
      ]
    }
  };
}

app.get("/:Type/:User", async (req, res) => {
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
      return res.send(yaml.stringify(ConfigUserInJson));
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