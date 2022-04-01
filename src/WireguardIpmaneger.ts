import * as mongo_user from "./model/users";
import * as IpMatching from "ip-matching";

/*
  Thanks to VIJAYABAL DHANAPAL
  stackoverflow answer https://stackoverflow.com/a/53760425
*/
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

async function getIpv4IP(): Promise<string> {
  const storageIps = (await mongo_user.getUsers()).map(User => User.wireguard).reduce((previousValue, currentValue) => currentValue.concat(previousValue), []).map(a => a.ip);
  const ipV4 = `10.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  if (!!storageIps.find(userIP => userIP.v4.ip === ipV4)) return getIpv4IP();
  return ipV4;
}

export async function gen_pool_ips(PoolNumber: number = 1) {
  const NewPool: Array<{v4: {ip: string; mask: string;}; v6: {ip: string; mask: string;};}> = [];
  for (let index = 0; index < PoolNumber; index++) {
    const ipV4 = await getIpv4IP();
    const ipV6 = convert_ipv4_to_ipv6(ipV4);
    NewPool.push({
      v4: {
        ip: ipV4,
        mask: IpMatching.getMatch(ipV4).convertToMasks()[0].convertToSubnet().toString().split("/")[1]
      },
      v6: {
        ip: ipV6,
        mask: IpMatching.getMatch(ipV6).convertToMasks()[0].convertToSubnet().toString().split("/")[1]
      }
    });
  }
  return NewPool;
}

export async function getWireguardip() {
  const users = (await mongo_user.getUsers()).map(User => User.wireguard).reduce((previousValue, currentValue) => currentValue.concat(previousValue), []).map(a => a.ip);
  const Ips = [... new Set(users.map(ips => {
    const [ip1, ip2, ip3] = ips.v4.ip.split(".");
    return `${ip1}.${ip2}.${ip3}.1`;
  }))];
  return Ips.map(ip => {
    const ipv6 = convert_ipv4_to_ipv6(ip);
    return {
      v4: {
        ip: ip,
        mask: IpMatching.getMatch(ip).convertToMasks()[0].convertToSubnet().toString().split("/")[1]
      },
      v6: {
        ip: ipv6,
        mask: IpMatching.getMatch(ipv6).convertToMasks()[0].convertToSubnet().toString().split("/")[1]
      }
    };
  });
}