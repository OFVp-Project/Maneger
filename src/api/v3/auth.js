const express = require("express");
const app = express.Router();
module.exports.app = app;
const mongo_v3_auth = require("../../mongo/v3/auth");

app.post("/register", async (req, res) => {
  /** @type {{email: string; password: string;}} */
  const { email, password } = req.body;
  const requires={email: {}, password: {}};
  if (!email) requires.email.message = "require email to register token.";
  if (!password) requires.password.message = "require password to register token.";
  if (password.length <= 7) requires.password.message_min = "short password";
  if (Object.keys(requires.email).concat(Object.keys(requires.password)).length > 0) return res.status(401).json(requires);
  if (await mongo_v3_auth.findBool(email)) return res.status(401).json({
    message: "email are is registered!"
  });
  return res.json(await mongo_v3_auth.registerToken({
    email: email,
    password: password,
    privilages: (await mongo_v3_auth.getAuths()).length === 0 ? "root":"user"
  }));
});

app.post("/update_privilegie", )