const mongo_user = require("./users");
const IpMatching = require("ip-matching");
const { Netmask } = require("netmask");

/** @type {{v4: {ip: string; mask: string;}; v6: {ip: string; mask: string;};}} */
const typeIps = {v4: {ip: "", mask: ""}, v6: {ip: "", mask: ""}}

let IgnoreIps = [];
/** @type {Array<typeIps>} */
let pool = [];
/** @type {typeIps} */
let wireguardInterface = {};
let lockLoadips = true;
module.exports.getWireguardip = async () => {
  await new Promise(async res => {
    while (true) {
      if (!lockLoadips) return res();
      await new Promise(res => setTimeout(res, 1000));
    }
  });
  return wireguardInterface;
}

const FilterUse = async () => {
  const Users = await mongo_user.getUsers();
  return IgnoreIps = IgnoreIps.filter(ip => Users.find(user => user.wireguard.find(ip2 => ip2.ip.v4.ip === ip)));
}

/** @param {string} ip IPv4  @returns {void} */
module.exports.addIgnoreIP = (ip) => {if (typeof ip === "string" && ip) {IgnoreIps.push(ip);return;}; throw new Error("Invalid IP");}
module.exports.gen_pool_ips = gen_pool_ips;
async function gen_pool_ips(PoolNumber = 1) {
  FilterUse();
  const Users = (await mongo_user.getUsers()).map(User => User.wireguard).reduce((previousValue, currentValue) => currentValue.concat(previousValue), []).map(a => a.ip);
  const IP_Pool = await getPoolIP();
  if (IP_Pool.length === 0) throw new Error("No ip avaibles");
  const NewPool = [];
  for (let index = 0; index < PoolNumber; index++) {
    const ip = IP_Pool.filter(Ip => !(Users.find(User => User.v4.ip === Ip.v4.ip)||IgnoreIps.find(User => User === Ip.v4.ip)))[Math.floor(Math.random()+Math.random() * (IgnoreIps.length+1))]
    IgnoreIps.push(ip.v4.ip);
    NewPool.push(ip);
    console.log(ip);
  }
  return NewPool;
}

async function getPoolIP() {
  await new Promise(async res => {
    while (true) {
      if (!lockLoadips) return res();
      await new Promise(res => setTimeout(res, 1000));
    }
  });
  return pool;
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

async function poolGen() {
  const NetPoolRange = "10.0.0.1-10.0.128.255";
  const IP_Pool = IpMatching.getMatch(NetPoolRange).convertToMasks().map((mask) => mask.convertToSubnet().toString()).map((mask) => {
    const Pool = [];
    (new Netmask(mask)).forEach(ip => Pool.push(ip));
    return Pool;
  }).reduce((acc, val) => acc.concat(val), []).map(ip => {
    return {
      v4: {
        ip: String(ip),
        mask: IpMatching.getMatch(ip).convertToMasks()[0].convertToSubnet().toString().split("/")[1]
      },
      v6: {
        ip: String(convert_ipv4_to_ipv6(ip)),
        mask: IpMatching.getMatch(convert_ipv4_to_ipv6(ip)).convertToMasks()[0].convertToSubnet().toString().split("/")[1]
      }
    };
  });
  return IP_Pool;
}
poolGen().then(res => {
  wireguardInterface = res.shift();
  pool = res;
  lockLoadips = false;
});