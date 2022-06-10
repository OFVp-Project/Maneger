import * as crypto from "crypto";
import mongoose from "mongoose";
import * as IpMatching from "ip-matching";
import { Connection } from "../mongo";
import fs from "fs";
import path from "path";

type WireguardKeys = Array<{
  keys: {
    Preshared: string,
    Private: string,
    Public: string},
  ip: {
    v4: {ip: string, mask: string},
    v6: {ip: string, mask: string}
  }
}>

type wireguardType = {
  UserId: string,
  Keys: WireguardKeys
};

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
const randomKeys = () => new Promise<{privateKey: Buffer, publicKey: Buffer}>((res, rej) => crypto.generateKeyPair("x25519", {publicKeyEncoding: {format: "der", type: "spki"}, privateKeyEncoding: {format: "der", type: "pkcs8"}}, (err: Error, publicKey: Buffer, privateKey: Buffer) => {if (err) rej(err); else res({privateKey, publicKey});}));

const storagePath = (process.env.NODE_ENV === "development"||process.env.NODE_ENV === "testing")? process.cwd():"/data";
export async function wireguardInterfaceConfig(): Promise<{Preshared: string; Private: string; Public: string;}> {
  if (fs.existsSync(path.resolve(storagePath, "wireguardInterface.json"))) return JSON.parse(fs.readFileSync(path.resolve(storagePath, "wireguardInterface.json"), "utf8"));
  const keysPairOne = await randomKeys(), keysPairTwo = await randomKeys();
  const keys = {
    Preshared: Buffer.from(keysPairTwo.privateKey.slice(16)).toString("base64"),
    Private: Buffer.from(keysPairOne.privateKey).slice(16).toString("base64"),
    Public: Buffer.from(keysPairOne.publicKey).slice(12).toString("base64"),
  };
  fs.writeFileSync(path.resolve(storagePath, "wireguardInterface.json"), JSON.stringify(keys, null, 2));
  return keys;
}

async function Random255(Min: number = 2, Max: number = 255) {
  const value = Math.floor(Math.random() * (Max - Min + 1)) + Min;
  if (value > Max) return Random255();
  else if (value < Min) return Random255();
  return value % 256;
}
async function createIp(filterFunc?: (value: string) => true|false|Promise<true|false>) {
  if (!filterFunc) filterFunc = () => false;
  const ips = await Promise.all((Array(4).fill(4)).map(() => Random255(2, 255)));
  if (ips[0] <= 192 && ips[0] >= 168) {
    ips[0] = 192;
    ips[1] = 168;
  } else if (ips[0] <= 172 && ips[0] >= 16) ips[0] = 172;
  else ips[0] = 10;
  const ip = ips.join(".");
  console.log(ip);
  const isFound = !!(await WireguardSchema.collection.findOne({Keys: {ip: {v4: {ip: ip}}}}));
  if (!!isFound === false) {
    if (!!(await filterFunc(ip)) === true) return createIp(filterFunc);
    console.log("[IP Gen]: IP accept %s", ip);
    return ip;
  } else return createIp();
}

const ips = [];
export async function AddKeys(UserId: string, KeysToRegister: number) {
  if (!!(await WireguardSchema.collection.findOne({UserId: UserId}))) throw new Error("User already exists");
  const Keys: WireguardKeys = await Promise.all(Array(KeysToRegister).fill(0).map(async () => {
    const keysPairOne = await randomKeys(), keysPairTwo = await randomKeys();
    const ipV4 = await createIp(ip => !!ips.includes(ip));
    ips.push(ipV4);
    const ipV6 = convert_ipv4_to_ipv6(ipV4);
    return {
      keys: {
        Preshared: Buffer.from(keysPairTwo.privateKey.slice(16)).toString("base64"),
        Private: Buffer.from(keysPairOne.privateKey).slice(16).toString("base64"),
        Public: Buffer.from(keysPairOne.publicKey).slice(12).toString("base64")
      },
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
    }
  }));
  await WireguardSchema.create({
    UserId,
    Keys
  });
  return Keys;
}

export async function getUsers(): Promise<Array<wireguardType>> {
  return await WireguardSchema.find({}).lean();
}

export async function findOne(UserID: string): Promise<WireguardKeys> {
  return (await WireguardSchema.findOne({UserId: UserID}).lean()).Keys;
}

export async function DeleteKeys(UserID: string) {
  return await WireguardSchema.findOneAndDelete({UserId: UserID}).lean();
}
