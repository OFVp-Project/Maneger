import * as path from "node:path";
import * as http from "node:http";
import express from "express";
import * as socket_io from "socket.io";
import BodyParse from "body-parser";
import cors from "cors";
import RateLimit from "express-rate-limit";
import ExpressSession from "express-session";
import sessionStore from "session-file-store";
import * as yaml from "yaml";
import { auth } from "./auth";
import { user } from "./user";
import { isDebug, onStorage, emailValidate } from "../pathControl";
import * as authSchema from "../schemas/auth";
import { RemoveKeysFromJson, authEndpoints, catchExpressError } from "./expressUtil";
if (!process.env.COOKIE_SECRET) {
  console.error("COOKIE_SECRET is not set");
  process.exit(1);
}

// Express
export const app = express();
export const Server = http.createServer(app);
export const io = new socket_io.Server(Server, {transports: ["websocket", "polling"], cors: {origin: "*"}});
app.use(catchExpressError);
app.use(cors());
app.use(BodyParse.urlencoded({extended: true}));
app.use(BodyParse.json());
app.use((req, _res, next) => {
  next();
  console.log("[API] Request IP: %s Method: %s, Path: %s", req.ip, req.method, req.originalUrl);
});
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
declare module "express-session" {
  export interface Session {
    userAuth?: authSchema.AuthToken
  }
}


// Auth Routes
const loginLimit = RateLimit({windowMs: 1*60*1000, max: 5});
app.route("/login").post<{}, {}, {Token?: string, Email?: string, Password?: string}, {}>(loginLimit, async (req, res) => {
  if (req.session.userAuth) return res.status(200).json(req.session.userAuth);
  const {Token, Email, Password} = req.body;
  if (!!Token) {
    if (typeof Token !== "string") return res.status(400).json({error: "Invalid token"});
    return authSchema.getAuth({Token: Token}).then(userToken => {
      req.session.userAuth = userToken;
      return new Promise((resolve, reject) => req.session.save((err?: Error) => {
        if (err) return reject(err);
        return resolve(userToken);
      }));
    }).then(res.json).catch(err => res.status(400).json({error: String(err)}));
  }
  if (typeof Email !== "string") return res.status(400).json({error: "Invalid email"});
  if (!emailValidate.test(Email)) return res.status(400).json({error: "Invalid email"});
  if (typeof Password !== "string") return res.status(400).json({error: "Invalid password"});
  if (Password.length <= 7) return res.status(400).json({error: "Invalid password length, must be at least 8 characters"});
  return authSchema.getAuth({Email: Email, Password: Password}).then(userAuth => {
    req.session.userAuth = userAuth;
    return new Promise((resolve, reject) => req.session.save((err?: Error) => {
      if (err) return reject(err);
      return resolve(userAuth);
    }));
  }).then(res.json).catch(err => res.status(400).json({error: String(err)}));
}).delete(loginLimit, async (req, res) => {
  if (!req.session.userAuth) return res.status(400).json({error: "No user logged in"});
  try {
    await new Promise((resolve, reject) => req.session.destroy(err => {if(err) return reject(err);resolve("")}));
    return res.sendStatus(200);
  } catch (err) {
    console.log(String(err.stack||err));
    return res.sendStatus(400).json({error: String(err.stack||err).split(/\r\n|\n/gi)});
  }
}).get(({res}) => res.sendFile(path.join(__dirname, "./login.html"))).all(({res}) => res.status(405).json({error: "Method not allowed"}));

// Token Routes
app.use("/auth", RateLimit({windowMs: 60*1000, max: 10}), authEndpoints, auth);

// Users Routes
app.use("/user", authEndpoints, async (_req, res, next) => {
  if (isDebug) return next();
  const users = await authSchema.authSchema.collection.countDocuments();
  if (users === 0) {
    console.log("[API] No auths found, capturing all requests");
    return res.status(403).json({error: "No auths found, capturing all requests, create new user to baypass this"});
  }
  return next();
}, user);


// Send 404 for all other routes
app.use((req, res) => res.status(404).json({
  message: "Path don't exist in API",
  error: "Path don't exist in API",
  status: 404,
  pathReq: req.originalUrl,
}));