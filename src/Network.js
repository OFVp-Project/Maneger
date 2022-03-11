const os = require("os");
const fs = require("fs");
const path = require("path");

module.exports.getInterfaces = getInterfaces;
/**
 * Get Local Network Interfaces
 * @returns {{[x: string]: {
 *    interface: string;
 *    mac: string;
 *    rx: number|undefined;
 *    tx: number|undefined;
 *    v4: {addresses: string; netmask: string; cidr: string;};
 *    v6: {addresses: string; netmask: string; cidr: string;};
 *  };}}
 */
function getInterfaces() {
  const interfaces = os.networkInterfaces();
  const localInterfaces = {};
  for (const name of Object.getOwnPropertyNames(interfaces)) {
    const SysPath = path.resolve("/sys/class/net", name, "statistics");
    const Inter = {
      interface: name,
      mac: "",
      rx: 0,
      tx: 0,
      v4: {addresses: "", netmask: "", cidr: ""},
      v6: {addresses: "", netmask: "", cidr: ""}
    }
    if (fs.existsSync(SysPath)) {
      Inter.rx = parseInt(fs.readFileSync(path.resolve(SysPath, "rx_bytes"), "utf8"));
      Inter.tx = parseInt(fs.readFileSync(path.resolve(SysPath, "tx_bytes"), "utf8"));
    }
    for (let iface of interfaces[name]) {
      if (!Inter.mac && iface.mac) Inter.mac = iface.mac;
      if (iface.family === "IPv4") {
        Inter.v4.addresses = iface.address;
        Inter.v4.netmask = iface.netmask;
        Inter.v4.cidr = iface.cidr;
      } else if (iface.family === "IPv6") {
        Inter.v6.addresses = iface.address;
        Inter.v6.netmask = iface.netmask;
        Inter.v6.cidr = iface.cidr;
      }
    }
    if (!(interfaces[name][0].internal)) localInterfaces[name] = Inter;
  }
  return localInterfaces;
}

module.exports.getInterfacesArray = () => {
  const interfaces = getInterfaces();
  return Object.keys(interfaces).map(name => interfaces[name]);
}