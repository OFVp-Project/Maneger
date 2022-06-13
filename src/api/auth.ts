import { Request, Response, NextFunction } from "express";
import * as mongo_auth from "../schemas/auth";
import { DecryptPassword } from "../PasswordEncrypt";

export async function authEndpoints(req: Request, res: Response, next: NextFunction) {
  const AuthEmail = req.session.email || req.body.AuthEmail || req.headers.ofvpemail;
  const AuthPassword: string|{iv: string; Encrypt: string} = req.session.password || req.body.AuthPassword || req.headers.ofvppassword;
  const AuthToken = req.body.AuthToken || req.headers.ofvptoken;
  const boolCheck = async () => {
    try {
      const users = await mongo_auth.getAuths();
      if (AuthEmail && AuthPassword) {
        const User = users.find(user => user.email === AuthEmail);
        if (User) {
          if (typeof Object(AuthPassword).iv === "string" && typeof Object(AuthPassword).Encrypt === "string") {
            if (Object(User.password).iv === Object(AuthPassword).iv && Object(User.password).Encrypt === Object(AuthPassword).Encrypt) {
              req.session.email = AuthEmail;
              req.session.password = AuthPassword;
              req.session.save();
              return true;
            }
          } else if (await DecryptPassword(Object(User.password)) === AuthPassword) {
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
