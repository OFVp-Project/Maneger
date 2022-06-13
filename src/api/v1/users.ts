import * as express from "express";
import * as usersIDs from "../../schemas/UserID";
import * as sshManeger from "../../schemas/ssh";
import * as Wireguard from "../../schemas/Wireguard";
import { app as WireguardRoute } from "./wireguard";
export const app = express.Router();

function ValidateRegister(req: {username: string; password: string; date_to_expire: string; ssh_connections: number|string; wireguard_peers: number|string;}) {
  const { username, password, date_to_expire, ssh_connections, wireguard_peers } = req;
  const ErrorInputs:Array<{parameter: string, message: string}> = [];
  if (!username) ErrorInputs.push({parameter: "username", message: "Username is required"});
  if (typeof username !== "string") ErrorInputs.push({parameter: "username", message: "Username must be a string"});
  if (!password) ErrorInputs.push({parameter: "password", message: "Password is required"});
  if (typeof password !== "string") ErrorInputs.push({parameter: "password", message: "Password must be a string"});
  if (!date_to_expire) ErrorInputs.push({parameter: "date_to_expire", message: "Date to expire is required"});
  const UserDate = new Date(date_to_expire);
  const futureDate = new Date(new Date().getTime() + (1000 * 60 * 60 * 24 * 2));
  if (UserDate.toString() === "Invalid Date") ErrorInputs.push({parameter: "date_to_expire", message: "Date to expire is invalid, please use YYYY-MM-DD or javascript Date object"});
  else if (UserDate.getTime() <= futureDate.getTime()) ErrorInputs.push({parameter: "date_to_expire", message: "Date to expire is in the future, date input: "+UserDate.toString()+", min require date: "+futureDate.toString()});
  if (parseInt(String(ssh_connections)) !== 0) {if (isNaN(parseInt(String(ssh_connections)))) ErrorInputs.push({parameter: "ssh_connections", message: "Ssh connections is required"});}
  if (parseInt(String(wireguard_peers)) !== 0) {
    if (isNaN(parseInt(String(wireguard_peers)))) ErrorInputs.push({parameter: "wireguard_peers", message: "Count to get keys and ips to wireguard"});
    else if (parseInt(String(wireguard_peers)) > 500) ErrorInputs.push({parameter: "wireguard_peers", message: "Count to get keys and ips to wireguard must be less than 500"});
  }
  return ErrorInputs;
}

app.use("/Wireguard", WireguardRoute);
app.route("/").post(async (req, res) => {
  const { username, password, date_to_expire, ssh_connections, wireguard_peers } = req.body as {username: string; password: string; date_to_expire: string; ssh_connections: number|string; wireguard_peers: number|string;};
  const ErrorInputs = ValidateRegister({username, password, date_to_expire, ssh_connections, wireguard_peers});
  if (ErrorInputs.length > 0) return res.status(400).json(ErrorInputs);
  if (username.trim().toLowerCase().trim() === "root") return res.status(400).json({message: "not allowed to root username"});
  if (!!(await usersIDs.UserSchema.findOne({Username: String(username)}).lean())) return res.status(400).json({message: "username already exists"});
  // Register ID
  const UserId = await usersIDs.RegisterUser(username, new Date(date_to_expire));
  // Register SSH and Wireguard
  const [ssh, wireguard] = await Promise.all([
    sshManeger.CreateUser(UserId.UserId, username, new Date(date_to_expire), password, parseInt(String(ssh_connections))),
    Wireguard.AddKeys(UserId.UserId, parseInt(String(wireguard_peers)))
  ]);

  // Return data
  return res.json({
    UserId: UserId.UserId,
    Username: username,
    Expire: new Date(date_to_expire),
    Wireguard: wireguard,
    SSH: {
      maxConnections: ssh.maxConnections,
    }
  });
}).get(async ({res}) => {
  const [ids, ssh, wireguard] = await Promise.all([usersIDs.GetUsers(), sshManeger.getUsers(), Wireguard.getUsers()]);
  const usersMap = [];
  for (const id of ids) {
    const DDa = {
      ...id,
      ssh: ssh.find(ssh => ssh.UserID === id.UserId),
      wireguard: wireguard.find(wireguard => wireguard.UserId === id.UserId)
    };
    if (!!DDa.ssh) delete DDa.ssh.UserID;
    if (!!DDa.wireguard) delete DDa.wireguard.UserId;
    usersMap.push(DDa);
  }
  return res.json(usersMap);
}).delete(async (req, res) => {
  const {username} = req.body;
  const user = await usersIDs.UserSchema.findOne({Username: String(username)});
  if (!user) return res.status(404).json({error: "User not found"});
  const ResDel = await Promise.all([Wireguard.DeleteKeys(user.UserId), sshManeger.deleteUser(user.UserId), usersIDs.DeleteUser(user.UserId)])
  return res.json(ResDel);
});