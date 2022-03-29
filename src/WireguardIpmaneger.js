const mongo_user = require("./mongo/Schemas/users");
const IpMatching = require("ip-matching");
// const { Netmask } = require("netmask");

let IgnoreIps = [];
/** @param {string} ip IPv4  @returns {void} */
module.exports.addIgnoreIP = (ip) => {if (typeof ip === "string" && ip) {IgnoreIps.push(ip);return;}; throw new Error("Invalid IP");}

module.exports.gen_pool_ips = gen_pool_ips;
async function gen_pool_ips(PoolNumber = 1) {
  const getIpv4IP = async () => {
    const data = (await mongo_user.getUsers()).map(User => User.wireguard).reduce((previousValue, currentValue) => currentValue.concat(previousValue), []).map(a => a.ip);
    const ipV4 = `10.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
    if (!data.find(ip => ip.v4.ip === ipV4)) return ipV4;
    else return await UsersFilter();
  }
  const NewPool = [];
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

module.exports.getWireguardip = getWireguardip;
async function getWireguardip() {
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

/*
  Thanks to VIJAYABAL DHANAPAL
  stackoverflow answer https://stackoverflow.com/a/53760425
*/
function convert_ipv4_to_ipv6(ipV4 = ""){
  const classValues = ipV4.split(".");
  if(classValues.length){  
    const str = classValues.reduce((acc, val, ind) => {
      const mod = +val >= 16 ? +val%16 : +val;
      const divider = +val >= 16 ? (val-mod)/16 : 0;
      const hexaCode = (hexaVal)=>{
        if (hexaVal === 10) return "A";
        else if (hexaVal === 11) return "B";
        else if (hexaVal === 12) return "C";
        else if (hexaVal === 13) return "D";
        else if (hexaVal === 14) return "E";
        else if (hexaVal === 15) return "F";
        else return hexaVal;
      }
      const modRes = hexaCode(mod);
      const dividerRes = hexaCode(divider);
      return ind === 1 ? `${acc}${dividerRes}${modRes}:`:`${acc}${dividerRes}${modRes}`;
    }, "");
    return `2002:${str}::`;
  }
  throw "Invalid Address";
}

// (async function () {
//   const NetPoolRange = "10.0.0.1-10.0.128.255";
//   const IP_Pool = IpMatching.getMatch(NetPoolRange).convertToMasks().map((mask) => mask.convertToSubnet().toString()).map((mask) => {
//     const Pool = [];
//     (new Netmask(mask)).forEach(ip => Pool.push(ip));
//     return Pool;
//   }).reduce((acc, val) => acc.concat(val), []).map(ip => {
//     return {
//       v4: {
//         ip: String(ip),
//         mask: IpMatching.getMatch(ip).convertToMasks()[0].convertToSubnet().toString().split("/")[1]
//       },
//       v6: {
//         ip: String(convert_ipv4_to_ipv6(ip)),
//         mask: IpMatching.getMatch(convert_ipv4_to_ipv6(ip)).convertToMasks()[0].convertToSubnet().toString().split("/")[1]
//       }
//     };
//   });
//   return IP_Pool;
// })().then(res => {
//   console.log("Wireguard IP range length %d.", res.length);
// });
