import express from "express";
import * as mongo_v3_auth from "../../schemas/auth";
export const app = express.Router();

app.post("/register", async (req, res) => {
  const { email, password } = req.body as {email: string; password: string;};
  if (!email) return res.status(400).json({message: "require email to register token."});
  if (!password) return res.status(400).json({message: "require password to register token."});
  if (password.length <= 7) return res.status(400).json({message: "short password"});
  if (await mongo_v3_auth.findBool(email)) return res.status(401).json({
    message: "email are is registered!"
  });
  return res.json(await mongo_v3_auth.registerToken({
    email: email,
    password: password,
    privilages: (await mongo_v3_auth.getAuths()).length === 0 ? "root":"user"
  }));
});

app.post("/delete", async (req, res) => {
  await mongo_v3_auth.deleteAuth(req.body.email, req.body.password);
  return res.sendStatus(200);
});

app.post("/update_privilegie", async (req, res) => {
  const { email, privilege } = req.body;
  const auth = await mongo_v3_auth.findOne(email);
  if (!auth) return res.status(400).json({
    message: "Auth not found"
  });
  const data = await mongo_v3_auth.update_privilegie(email, privilege === "root" ? "root" : "user");
  if (data === "no update") return res.status(400).json({
    message: "no update"
  });
  return res.json(data);
});