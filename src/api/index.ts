import path from "node:path";
import http from "node:http";
import express from "express";
import RateLimit from "express-rate-limit";
import BodyParse from "body-parser";
import cors from "cors";
import ExpressSession, { Session } from "express-session";
import sessionStore from "session-file-store";
import * as yaml from "yaml";
import * as Auth from "../schemas/auth";
import * as userAuth from "./auth";
import * as usersv1 from "./v1/users";
import * as authv1 from "./v1/auth";
import { onStorage } from "../pathControl";
import * as authSchema from "../schemas/auth"

// Express
export const app = express();
export const Server = http.createServer(app);
export const session = Session;

declare module "express-session" {
  interface Session {
    Session;
    email: string;
    password: string|{iv: string; Encrypt: string;};
  }
}

app.use((req, _, next) => {
  next();
  console.log("[API] Request IP: %s Method: %s, Path: %s", req.ip, req.method, req.originalUrl);
});
app.use(cors());
app.use(BodyParse.urlencoded({extended: true}));
app.use(BodyParse.json());
function RemoveKeysFromJson(objRec, keyToDel: Array<string>) {
  return JSON.parse(JSON.stringify(objRec, (key, value) => {
    if (keyToDel.includes(key)) return undefined;
    else if (typeof value === "string") return value.replace(/\r\n/g, "\n");
    return value;
  }));
}
app.use((req, res, next) => {
  res.json = (body) => {
    body = RemoveKeysFromJson(body, ["__v", "_id"]);
    if (req.query.type === "yaml"||req.query.type === "yml") {
      res.setHeader("Content-Type", "text/yaml");
      res.send(yaml.stringify(body));
      return res;
    }
    res.set("Content-Type", "application/json");
    res.send(JSON.stringify(body, (_, value) => {
      if (typeof value === "bigint") return value.toString();
      return value;
    }, 2));
    return res;
  }
  return next();
});


if (!process.env.COOKIE_SECRET) {
  console.log("COOKIE_SECRET is not defined");
  process.exit(1);
}
app.use(ExpressSession({
  secret: process.env.COOKIE_SECRET,
  name: "ofvp_session",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: false,
    secure: "auto",
    maxAge: (1000 * 60 * 60 * 24 * 30),
  },
  store: new (sessionStore(ExpressSession))({
    path: path.join(onStorage, "sessionsDir"),
    secret: process.env.COOKIE_SECRET
  })
}));

app.use(async (req, res, next) => {
  const users = await authSchema.getAuths();
  if (users.length === 0) {
    console.log("[API] No auths found, capturing all requests");
    if (req.method.toLowerCase() === "post") {
      
    }
  }
  return next();
});

// Auth Path
const loginLimit = RateLimit({windowMs: 1*60*1000, max: 5});
app.route("/login").get(userAuth.authEndpoints, async (req, res) => res.status(200).json(req.session)).post(loginLimit, async (req, res) => {
  const { Email, Password } = req.body as { Email: string, Password: string };
  try {
    const userData = await Auth.checkAuth(Email, Password);
    if (userData) {
      req.session.email = Email;
      req.session.password = userData.password;
      await new Promise<void>((resolve, reject) => req.session.save((err?: Error) => {
        if (err) return reject(err);
        return resolve();
      }));
    }
    return res.sendStatus(200);
  } catch (err) {
    return res.status(400).json({error: String(err)});
  }
}).delete(loginLimit, async (req, res) => {
  try {
    await new Promise((resolve, reject) => req.session.destroy(err => {if(err) return reject(err);resolve("")}));
    return res.sendStatus(200);
  } catch (err) {
    console.log(String(err.stack||err));
    return res.sendStatus(400).json({error: String(err.stack||err).split(/\r\n|\n/gi)});
  }
}).all(({res}) => res.status(405).json({error: "Method not allowed"}));

// API routes
app.use("/users", userAuth.authEndpoints, usersv1.app);
app.use("/auth", userAuth.authEndpoints, RateLimit({windowMs: 60*1000, max: 10}), authv1.app);

// Send 404 for all other routes
app.use((req, res) => res.status(404).json({
  message: "Path don't exist in API",
  error: "Path don't exist in API",
  status: 404,
  pathReq: req.originalUrl,
}));

// Catch errors
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.status(500).json({
    message: "Sorry an error occured, please try again later",
    error: String(err),
    status: 500,
    pathReq: req.originalUrl
  });
  console.trace(err);
  return {err, req, res, next};
});