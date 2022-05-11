import * as Wireguard from "./Wireguard";

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
  console.log("Get Root Key");
  const RootKeys = await Promise.all(Keys.map(() => Wireguard.wireguardInterfaceConfig()));

  // Register wireguard keys
  console.log("Register Wireguard Keys");
  const AddKey = await Promise.all(Keys.map((key) => Wireguard.AddKeys(key, key.length)));

  // Get Wireguard Keys
  console.log("Find Wireguard Keys");
  const find = await Promise.all(Keys.map((key) => Wireguard.findOne(key)));

  // Get all keys
  console.log("Get all keys");
  const allKeys = await Wireguard.getUsers();

  // Delete key
  console.log("Delete key");
  const DeleteKey = await Promise.all(Keys.map((key) => Wireguard.DeleteKeys(key)));

  return {RootKeys, AddKey, find, allKeys, DeleteKey};
}