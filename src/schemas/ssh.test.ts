import * as ssh from "./ssh";

// Short Script run test fastly
export async function main() {
  // Create test
  console.log("Creating User");
  const Create = await ssh.CreateUser("testSSH", "testSSH", new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), "testSSH", 0);
  console.log("Created User Result:\n%o", Create);

  // Update Password
  console.log("Updating Password");
  const PassUpdate = await ssh.UpdatePassword("testSSH", "testSSH2");
  console.log("Updated Password Result:\n%o", PassUpdate);

  // Get All users
  console.log("Getting All Users");
  const Users = await ssh.getUsers();
  console.log("Users:\n%o", Users);

  // Delete User
  console.log("Deleting User");
  const Deleted = await ssh.deleteUser("testSSH");
  console.log("Deleted User Result:\n%o", Deleted);

  return {Create, PassUpdate, Users, Deleted};
}

// Run stress script test
export async function long(Keys: Array<string>) {
  // Create users test
  console.log("[SSH]: Creating Users");
  const startCreate = Date.now();
  const Create = await Promise.all(Keys.map((key) => ssh.CreateUser(key, key, new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), key, 0)));
  console.log("[SSH]: Execution time: %o", Date.now() - startCreate);

  // Update Password
  console.log("[SSH]: Updating Passwords");
  const startUpdate = Date.now();
  const PassUpdate = await Promise.all(Keys.map((key) => ssh.UpdatePassword(key, key + "2")));
  console.log("[SSH]: Execution time: %o", Date.now() - startUpdate);

  // Get All users
  console.log("[SSH]: Getting All Users");
  const startGetUsers = Date.now();
  const Users = await ssh.getUsers();
  console.log("[SSH]: Execution time: %o", Date.now() - startGetUsers);

  // Delete Users
  console.log("[SSH]: Deleting Users");
  const startDelete = Date.now();
  const Deleted = await Promise.all(Keys.map((key) => ssh.deleteUser(key)));
  console.log("[SSH]: Execution time: %o", Date.now() - startDelete);

  return {Create, PassUpdate, Users, Deleted};
}