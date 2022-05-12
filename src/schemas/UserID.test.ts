import * as UserID from "./UserID";

// Short Script run test fastly
export async function main() {
  // Create user test
  console.log("Creating User");
  const AddUser = await UserID.RegisterUser("TestID", new Date(Date.now() + 1000 * 60 * 60 * 24 * 7));
  console.log("Created User Result:\n%o", AddUser);

  // Get All users
  console.log("Getting All Users");
  const GetUsers = await UserID.GetUsers();
  console.log("Users:\n%o", GetUsers);

  // Delete User
  console.log("Deleting User");
  const DeleteUser = await UserID.DeleteUser(AddUser.UserId);
  console.log("Deleted User Result:\n%o", DeleteUser);

  return {AddUser, GetUsers, DeleteUser};
}

// Run stress script test
export async function long(Keys: Array<string>) {
  // Create users test
  console.log("[UsersID]: Creating Users");
  const startCreate = Date.now();
  const AddUsers = await Promise.all(Keys.map((key) => UserID.RegisterUser(key, new Date(Date.now() + 1000 * 60 * 60 * 24 * 7))));
  console.log("[UsersID]: Execution time: %o", Date.now() - startCreate);

  // Get All users
  console.log("[UsersID]: Getting All Users");
  const startGetUsers = Date.now();
  const GetUsers = await UserID.GetUsers();
  console.log("[UsersID]: Execution time: %o", Date.now() - startGetUsers);

  // Delete Users
  console.log("[UsersID]: Deleting Users");
  const startDelete = Date.now();
  const DeleteUsers = await Promise.all(Keys.map((key) => UserID.DeleteUser(key)));
  console.log("[UsersID]: Execution time: %o", Date.now() - startDelete);

  return {AddUsers, GetUsers, DeleteUsers};
}