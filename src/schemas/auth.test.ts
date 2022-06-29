import * as auth from "./auth";

// Run stress script test
export async function long(Keys: Array<string>) {
  const tempAuth = await auth.createUserAuth({Email: "temp@gmail.com", Password: "NotSimples"});
  console.log("Temp token create, body: %o", tempAuth);
  await Promise.all(Keys.map(() => auth.createToken(tempAuth.Token).then(res => console.log("Token: %s", res.Token))));
  console.log("Deleting tokens");
  return auth.deleteToken({Email: tempAuth.Email, Password: "NotSimples"});
}