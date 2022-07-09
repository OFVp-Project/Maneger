import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import mongoose from "mongoose";
import * as IpMatching from "ip-matching";
import * as nodeCidr from "../lib/node-cidr";
import { Connection } from "../mongo";
import { onStorage } from "../pathControl";

type key = {Preshared: string, Private: string, Public: string};
type ip = {v4: {ip: string, mask?: string}, v6?: {ip: string, mask: string}};
export type wireguardType = {UserId: string, Keys: {keys?: key, ip: ip}[]};
export const WireguardSchema = Connection.model<wireguardType>("Wireguard", new mongoose.Schema<wireguardType>({
  UserId: {
    type: String,
    required: true,
    unique: true
  },
  Keys: [
    {
      keys: {
        Preshared: {
          type: String,
          unique: true,
          required: true
        },
        Private: {
          type: String,
          unique: true,
          required: true
        },
        Public: {
          type: String,
          unique: true,
          required: true
        }
      },
      ip: {
        v4: {
          ip: {
            type: String,
            unique: true,
            required: true
          },
          mask: {
            type: String,
            required: true
          }
        },
        v6: {
          ip: {
            type: String,
            unique: true,
            required: true
          },
          mask: {
            type: String,
            required: true
          }
        }
      }
    }
  ]
}));

function convert_ipv4_to_ipv6(ipV4 = ""){
  const hexaCode = (hexaVal: number)=>{
    if (hexaVal === 10) return "A";
    else if (hexaVal === 11) return "B";
    else if (hexaVal === 12) return "C";
    else if (hexaVal === 13) return "D";
    else if (hexaVal === 14) return "E";
    else if (hexaVal === 15) return "F";
    else return hexaVal;
  }
  const classValues = ipV4.split(".");
  if(classValues.length){
    const str = classValues.reduce((acc, val, ind) => {
      const mod = +val >= 16 ? +val%16 : +val;
      const divider = +val >= 16 ? (parseFloat(val)-mod)/16 : 0;
      const modRes = hexaCode(mod);
      const dividerRes = hexaCode(divider);
      return ind === 1 ? `${acc}${dividerRes}${modRes}:`:`${acc}${dividerRes}${modRes}`;
    }, "");
    return `2002:${str}::`;
  }
  throw "Invalid Address";
}

// Create Random Keys
const randomKeys = () => new Promise<{privateKey: string, publicKey: string}>((res, rej) => crypto.generateKeyPair("x25519", {publicKeyEncoding: {format: "der", type: "spki"}, privateKeyEncoding: {format: "der", type: "pkcs8"}}, (err: Error, publicKey: Buffer, privateKey: Buffer) => {
  if (err) rej(err);
  else res({
    privateKey: Buffer.from(privateKey.slice(16)).toString("base64"),
    publicKey: Buffer.from(publicKey.slice(12)).toString("base64")
  });
}));

export async function wireguardInterfaceConfig(): Promise<{Preshared: string; Private: string; Public: string;}> {
  if (fs.existsSync(path.resolve(onStorage, "wireguardInterface.json"))) return JSON.parse(fs.readFileSync(path.resolve(onStorage, "wireguardInterface.json"), "utf8"));
  const keysPairOne = await randomKeys(), keysPairTwo = await randomKeys();
  const keys = {Preshared: keysPairTwo.privateKey, Private: keysPairOne.privateKey, Public: keysPairOne.publicKey};
  fs.writeFileSync(path.resolve(onStorage, "wireguardInterface.json"), JSON.stringify(keys, null, 2));
  return keys;
}

async function shuffleIps(): Promise<string[]> {
  const array = nodeCidr.cidr.ips("192.168.1.1/16").concat(nodeCidr.cidr.ips("172.0.0.1/24")).concat(nodeCidr.cidr.ips("10.0.0.1/24"));
  for (let i = array.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, array.length-1);
    const temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
  return array
}

async function createIp(ignore: string[] = []) {
  const ips = (await shuffleIps()).filter(x => !ignore.includes(x));
  if (ips.length < ignore.length) throw new Error("Max ip");
  let ip = ips[crypto.randomInt(0, ips.length-1)];
  const findInDb = await WireguardSchema.findOne({
    Keys: {
      ip: {
        v4: {ip: ip}
      }
    }
  }).lean();
  if (!!findInDb) return createIp([...ignore, ip]);
  return ip;
}
export async function AddKeys(UserId: string, KeysToRegister: number) {
  if (KeysToRegister <= 0) return [];
  if (!!(await WireguardSchema.collection.findOne({UserId: UserId}))) throw new Error("User already exists");
  const Keys = [];
  while(KeysToRegister > 0){
    KeysToRegister--
    const keysPairOne = await randomKeys(), keysPairTwo = await randomKeys();
    const ipV4 = await createIp();
    const ipV6 = convert_ipv4_to_ipv6(ipV4);
    const data = {
      keys: {Preshared: keysPairTwo.privateKey, Private: keysPairOne.privateKey, Public: keysPairOne.publicKey},
      ip: {
        v4: {
          ip: ipV4,
          mask: IpMatching.getMatch(ipV4).convertToMasks()[0].ip.bits.toString()
        },
        v6: {
          ip: ipV6,
          mask: IpMatching.getMatch(ipV6).convertToMasks()[0].ip.bits.toString()
        }
      }
    };
    Keys.push(data);
  }
  await WireguardSchema.create({
    UserId,
    Keys
  });
  return Keys;
}

export async function getUsers(): Promise<Array<wireguardType>> {
  return await WireguardSchema.find({}).lean();
}

export async function findOne(UserID: string): Promise<Array<{keys?: key, ip: ip}>> {
  if (typeof UserID !== "string") throw new Error("UserID must be a string");
  const user = await WireguardSchema.findOne({UserId: UserID}).lean();
  if (!user) throw new Error("User not found");
  return user.Keys;
}

export async function DeleteKeys(UserID: string) {
  if (typeof UserID !== "string") throw new Error("UserID must be a string");
  return await WireguardSchema.findOneAndDelete({UserId: UserID}).lean();
}
