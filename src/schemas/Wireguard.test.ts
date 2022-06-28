import * as Wireguard from "./Wireguard";
import * as crypto from "node:crypto";

// Short Script run test fastly
export async function main() {
  // Get Root Key
  console.log("Get Root Key");
  const RootKeys = await Wireguard.wireguardInterfaceConfig();
  console.log("Root Keys:\n%o", RootKeys);

  // Register wireguard keys
  console.log("Register Wireguard Keys");
  const AddKey = await Wireguard.AddKeys("test", 5);
  console.log("AddKey:\n%o", AddKey);

  // Get Wireguard Keys
  console.log("Find Wireguard Keys");
  const find = await Wireguard.findOne("test");
  console.log("Find:\n%o", find);

  // Get all keys
  console.log("Get all keys");
  const allKeys = await Wireguard.getUsers();
  console.log("All Keys:\n%o", allKeys);

  // Delete key
  console.log("Delete key");
  const DeleteKey = await Wireguard.DeleteKeys("test");
  console.log("DeleteKey:\n%o", DeleteKey);

  return {RootKeys, AddKey, find, allKeys, DeleteKey};
}

// Run stress script test
export async function long(Keys: Array<string>) {
  // Get Root Key
  console.log("[Wireguard]: Get Root Key");
  const startKeys = Date.now();
  const RootKeys = await Promise.all(Keys.map(() => Wireguard.wireguardInterfaceConfig()));
  console.log("[Wireguard]: Execution time: %o", Date.now() - startKeys);

  // Register wireguard keys
  console.log("[Wireguard]: Register Wireguard Keys");
  const startAddKey = Date.now();
  const AddKey = await Promise.all(Keys.map((key) => {
    const keysToGen = crypto.randomInt(0, 128);
    Wireguard.AddKeys(key, keysToGen).catch(() => Wireguard.AddKeys(key, keysToGen)).catch(err => {
      return String(err.stack||err);
    });
  }));
  console.log("[Wireguard]: Execution time: %o", Date.now() - startAddKey);

    // Get all keys
    console.log("[Wireguard]: Get all keys");
    const startAllKeys = Date.now();
    const allKeys = await Wireguard.getUsers();
    console.log("[Wireguard]: Execution time: %o", Date.now() - startAllKeys);

  // Get Wireguard Keys
  console.log("[Wireguard]: Find Wireguard Keys");
  const startFind = Date.now();
  const find = await Promise.all(Keys.map((key) => Wireguard.findOne(key).catch(err => {
    return String(err.stack||err);
  })));
  console.log("[Wireguard]: Execution time: %o", Date.now() - startFind);

  // Delete key
  console.log("[Wireguard]: Delete key");
  const startDeleteKey = Date.now();
  const DeleteKey = await Promise.all(Keys.map((key) => Wireguard.DeleteKeys(key).catch(err => {
    return String(err.stack||err);
  })));
  console.log("[Wireguard]: Execution time: %o", Date.now() - startDeleteKey);

  return {RootKeys, AddKey, find, allKeys, DeleteKey, Ips: ([]).concat(...allKeys.map(a => a.Keys.map(b => b.ip.v4.ip)))};
}