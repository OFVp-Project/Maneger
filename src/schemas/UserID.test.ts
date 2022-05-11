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
  console.log("Creating Users");
  const AddUsers = await Promise.all(Keys.map((key) => UserID.RegisterUser(key, new Date(Date.now() + 1000 * 60 * 60 * 24 * 7))));

  // Get All users
  console.log("Getting All Users");
  const GetUsers = await UserID.GetUsers();

  // Delete Users
  console.log("Deleting Users");
  const DeleteUsers = await Promise.all(Keys.map((key) => UserID.DeleteUser(key)));

  return {AddUsers, GetUsers, DeleteUsers};
}