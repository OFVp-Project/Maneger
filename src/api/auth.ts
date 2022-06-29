import express from "express";
import { emailValidate } from "../pathControl";
import * as authSchema from "../schemas/auth";
import { catchExpressError } from "./expressUtil";
export const auth = express.Router();
auth.use(catchExpressError);

// Get all users
auth.get("/", ({res}) => authSchema.authSchema.collection.find().toArray().then(data => res.json(data)));
type authCreateBody = {email?: string, password?: string, token?: string};
type authCreateQuery = {tokenOnly?: "true"|"false"};

auth.post<{}, {}, authCreateBody, authCreateQuery>("/", (req, res, next) => authSchema.expressSessionVerify([{keyName: "addTokens", content: "write"}], {req, res, next}), async (req, res): Promise<any> => {
  if (req.query.tokenOnly === "true") {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: "Token required" });
    if (typeof token !== "string") return res.status(400).json({ error: "Token must be a string" });
    if (req.session.userAuth.Token === token) return res.status(401).json({ error: "Unauthorized", message: "Token already used" });
    return authSchema.createToken(token).then(token => res.json(token)).catch(err => res.status(400).json({ error: String(err) }));
  }
  // User Login
  const failures: Array<{Parameter: string, Error: string}> = [];
  const {email, password} = req.body;
  if (typeof email !== "string") failures.push({Parameter: "email", Error: "Invalid email"});
  else if (!emailValidate.test(email)) failures.push({Parameter: "email", Error: "Invalid email"});
  else if (req.session.userAuth?.Email === email) failures.push({Parameter: "email", Error: "Email already used"});
  if (typeof password !== "string") failures.push({Parameter: "password", Error: "Invalid password"});
  else if (password?.length <= 7) failures.push({Parameter: "password", Error: "Invalid password length, must be at least 8 characters"});
  if (failures.length > 0) return res.status(400).json(failures);
  // Register in database
  return authSchema.createUserAuth({Email: email, Password: password}).then(user => res.json(user)).catch(err => res.status(400).json({ error: String(err) }));
});

type authUpdatePasswordBody = {Email: string, Password: string, newPassword?: string};
auth.put<{}, {}, authUpdatePasswordBody, {}>("/", async (req, res) => {
  const { Email, Password, newPassword } = req.body;
  if (typeof Email !== "string") return res.status(400).json({ error: "Invalid email" });
  else if (!emailValidate.test(Email)) return res.status(400).json({ error: "Invalid email" });
  else if (!(req.session.userAuth.Privilages.admin === "write"||req.session.userAuth.Privilages.addTokens === "write"||req.session.userAuth.Email === Email)) return res.status(403).json({error: "Forbidden", message: "You don't have permission to do this"});
  if (typeof Password !== "string") return res.status(400).json({ error: "Invalid password" });
  else if (Password.length <= 7) return res.status(400).json({ error: "Invalid password length, must be at least 8 characters" });
  if (typeof newPassword !== "string") return res.status(400).json({ error: "Invalid new password" });
  else if (newPassword.length <= 7) return res.status(400).json({ error: "Invalid new password length, must be at least 8 characters" });
  return authSchema.updatePassword({Email: Email, Password: Password, NewPassword: newPassword}).then(data => res.json(data)).catch(err => res.status(400).json({ error: String(err) }));
});

type authUpdatePrivelegies = {Email: string, Password: string} & authSchema.privileges;
auth.put<{}, {}, authUpdatePrivelegies, {}>("/updatePrivilegie", (req, res, next) => authSchema.expressSessionVerify([{keyName: "addTokens", content: "write"}], {req, res, next}), async (req, res) => {
  const { Email, Password, admin, users, addTokens } = req.body;
  if (typeof Email !== "string") return res.status(400).json({ error: "Invalid email" });
  else if (!emailValidate.test(Email)) return res.status(400).json({ error: "Invalid email" });
  if (typeof Password !== "string") return res.status(400).json({ error: "Invalid password" });
  else if (Password.length <= 7) return res.status(400).json({ error: "Invalid password length, must be at least 8 characters" });
  if (!(admin === "read" || admin === "write")) return res.status(400).json({ error: "Invalid admin query", allow: ["read", "write"] });
  if (!(users === "read" || users === "write")) return res.status(400).json({ error: "Invalid users query", allow: ["read", "write"] });
  if (!(addTokens === "read" || addTokens === "write")) return res.status(400).json({ error: "Invalid addTokens query", allow: ["read", "write"] });
  return authSchema.updatePrivilegies({Email: Email, Password: Password, Privilages: {admin: admin, users: users, addTokens: addTokens}}).then(data => res.json(data)).catch(err => res.status(400).json({ error: String(err) }));
});

type authDeleteBody = {email?: string, password?: string, token?: string};
type authDeleteQuery = {isToken?: "true"|"false"};
auth.delete<{}, {}, authDeleteBody, authDeleteQuery>("/", (req, res, next) => authSchema.expressSessionVerify([{keyName: "addTokens", content: "write"}], {req, res, next}), async (req, res) => {
  if ((await authSchema.authSchema.countDocuments()) <= 1) return res.status(400).json({error: "Not allowed to delete last user, create new user first to delete this user"});
  if (req.query.isToken === "true") return authSchema.deleteToken({Token: req.body.token}).then(data => res.json(data)).catch(err => res.status(400).json({ error: String(err) }));
  const {email, password} = req.body;
  if (typeof email !== "string") return res.status(400).json({error: "Invalid email"});
  else if (!emailValidate.test(email)) return res.status(400).json({error: "Invalid email"});
  if (typeof password !== "string") return res.status(400).json({error: "Invalid password"});
  else if (password.length <= 7) return res.status(400).json({error: "Invalid password length, must be at least 8 characters"});
  return authSchema.deleteToken({Email: email, Password: password}).then(data => res.json(data)).catch(err => res.status(400).json({ error: String(err) }));
});