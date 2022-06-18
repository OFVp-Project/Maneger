import {Request, Response, NextFunction} from "express";
import { isDebug } from "../pathControl";
import * as authSchema from "../schemas/auth";

export function catchExpressError(err: Error, req: Request, res: Response, _next: NextFunction) {
  if (isDebug) console.trace(err);
  return res.status(500).json({
    message: "Sorry an error occured, please try again later",
    error: String(err).replace("Error: ", ""),
    status: 500,
    pathReq: req.originalUrl
  });
}

export function RemoveKeysFromJson(objRec, keyToDel: Array<string>) {
  return JSON.parse(JSON.stringify(objRec, (key, value) => {
    if (keyToDel.includes(key)) return undefined;
    else if (typeof value === "string") return value.replace(/\r\n/g, "\n");
    return value;
  }));
}

export async function sessionVerifyPrivilege(express: {req: Request, res: Response, next: NextFunction}, Privilages: Array<{req: authSchema.privilegesKeys, value: authSchema.privilegesValues}>) {
  if (isDebug||(await authSchema.authSchema.collection.countDocuments()) === 0) {
    console.log(isDebug ? "Debug mode is on" : "No users in database");
    return express.next();
  }
  if (Privilages.some((privilege) => express.req.session.userAuth.Privilages[privilege.req] === privilege.value)) return express.next();
  express.res.status(403).json({
    error: "Unauthorized",
    message: "You do not have permission to access this resource!"
  });
}

export async function authEndpoints(req: Request, res: Response, next: NextFunction) {
  if (isDebug||(await authSchema.authSchema.collection.countDocuments()) === 0) {
    console.log(isDebug ? "Debug mode is on" : "No users in database");
    return next();
  }
  if (req.session?.userAuth) {
    return authSchema.getAuth({Token: req.session.userAuth.Token}).then(() => next()).catch(err => {
      res.status(401).json({
        error: "Unauthorized",
        message: String(err)
      });
    });
  }
  const Email = req.body.AuthEmail || req.headers.ofvpemail;
  const Password = req.body.AuthPassword || req.headers.ofvppassword;
  if (typeof Email !== "string") return res.status(401).json({error: "Unauthorized", message: "Email required"});
  if (typeof Password !== "string") return res.status(401).json({error: "Unauthorized", message: "Password required"});
  return authSchema.getAuth({Email, Password}).then(userAuth => {
    req.session.userAuth = userAuth;
    return new Promise((resolve, reject) => req.session.save((err?: Error) => {
      if (err) return reject(err);
      return resolve(userAuth);
    }));
  }).then(() => next()).catch(err => {
    res.status(401).json({
      error: "Unauthorized",
      message: String(err).replace("Error: ", "")
    });
  });
};