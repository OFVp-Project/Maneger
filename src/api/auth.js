const express = require("express");
const mongo_auth = require("../mongo/Schemas/auth");
const { DecryptPassword } = require("../PasswordEncrypt");

module.exports.authEndpoints = authEndpoints;
/**
 * 
 * @param {express.Request} req 
 * @param {express.Response} res 
 * @param {import("express").NextFunction} next 
 */
async function authEndpoints(req, res, next) {
  const AuthEmail = req.session.email || req.body.AuthEmail || req.headers.ofvpemail;
  const AuthPassword = req.session.password || req.body.AuthPassword || req.headers.ofvppassword;
  const AuthToken = req.body.AuthToken || req.headers.ofvptoken;
  const boolCheck = async () => {
    try {
      const users = await mongo_auth.getAuths();
      if (AuthEmail && AuthPassword) {
        const User = users.find(user => user.email === AuthEmail);
        if (User) {
          if (typeof AuthPassword.iv === "string" && typeof AuthPassword.Encrypt === "string") {
            if (User.password.iv === AuthPassword.iv && User.password.Encrypt === AuthPassword.Encrypt) {
              req.session.email = AuthEmail;
              req.session.password = AuthPassword;
              req.session.save();
              return true;
            }
          } else if (await DecryptPassword(User.password) === AuthPassword) {
              req.session.email = AuthEmail;
              req.session.password = User.password;
              req.session.save();
            return true;
          }
        }
      } else if (AuthToken) {
        const user = users.find(user => user.token === AuthToken);
        if (user) {
          req.session.email = user.email;
          req.session.password = user.password;
          req.session.save();
          return true;
        }
      }
      return false;
    } catch (err) {
      console.error(err);
      return false;
    }
  }
  if (process.env.NODE_ENV === "development"||process.env.NODE_ENV === "testing") return next();
  if ((await mongo_auth.getAuths()).length === 0) {
    if (req.method === "POST") return next();
    return res.status(401).json({
      error: "Register fist token"
    });
  }
  if (await boolCheck()) return next();
  return res.status(401).json({
    error: "no auth"
  });
}
