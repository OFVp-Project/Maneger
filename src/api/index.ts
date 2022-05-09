import path from "path";
import http from "http";
import express from "express";
import RateLimit from "express-rate-limit";
import BodyParse from "body-parser";
import cors from "cors";
import ExpressSession, { Session } from "express-session";
import sessionStore from "session-file-store";
import * as yaml from "yaml";
import * as Auth from "../model/auth";
import * as userAuth from "./auth";
import * as usersv1 from "./v1/users";
import * as authv1 from "./v1/auth";
import * as metric from "./metric";
import * as Wireguard from "../schemas/Wireguard";

// Express
export const app = express();
export const Daemon = express();
export const Server = http.createServer(app);
export const session = Session;
const storagePath = (process.env.NODE_ENV === "development"||process.env.NODE_ENV === "testing")? process.cwd():"/data";

declare module "express-session" {
  interface Session {
    Session;
    email: string;
    password: string|{iv: string; Encrypt: string;};
  }
}

function NormaliseJson(objRec, keyToDel: Array<string>) {
  return JSON.parse(JSON.stringify(objRec, (key, value) => {
    if (keyToDel.includes(key)) return undefined;
    else if (typeof value === "string") return value.replace(/\r\n/g, "\n");
    return value;
  }));
}

Daemon.use((req, res, next) => {
  if (!process.env.DAEMON_PASSWORD && !process.env.DAEMON_USER) return next();
  else if(process.env.DAEMON_PASSWORD === req.headers.daemon_pass && process.env.DAEMON_USER === req.headers.daemon_user) return next();
  else return res.status(400).json({error: "Invalid credentials"})
});
Daemon.use(cors());
Daemon.use(BodyParse.urlencoded({extended: true}));
Daemon.use(BodyParse.json());
Daemon.get("/wginternal", ({res}) => Wireguard.wireguardInterfaceConfig().then(config => res.json(config)));

app.use(cors());
app.use(BodyParse.urlencoded({extended: true}));
app.use(BodyParse.json());
app.use((req, res, next) => {
  res.json = (body) => {
    body = NormaliseJson(body, ["__v", "_id"]);
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
app.use(metric.app);

if (!process.env.COOKIE_SECRET) throw new Error("COOKIE_SECRET is not defined");
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
    path: path.join(storagePath, "sessionsDir"),
    secret: process.env.COOKIE_SECRET
  })
}));

// API routes
app.post("/login", RateLimit({windowMs: 1*60*1000, max: 5}), async (req, res) => {
  const { Email, Password } = req.body as { Email: string, Password: string };
  var ConnectedStatus = false;
  try {
    const userData = await Auth.checkAuth(Email, Password);
    if (userData) {
      req.session.email = Email;
      req.session.password = userData.password;
      await new Promise((resolve, reject) => req.session.save(err => {if(err) return reject(err);resolve("")}));
      ConnectedStatus = true;
    }
    res.set("AuthStatus", String(ConnectedStatus));
    return res.sendStatus(200);
  } catch (err) {
    return res.status(400).json({error: String(err.stack||err).split("\n")});
  }
});
app.post("/authCheck", userAuth.authEndpoints, async ({res}) => res.sendStatus(200));
app.post("/logout", RateLimit, async (req, res) => {
  try {
    await new Promise((resolve, reject) => req.session.destroy(err => {if(err) return reject(err);resolve("")}));
    return res.sendStatus(200);
  } catch (err) {
    console.log(String(err.stack||err));
    return res.sendStatus(400).json({error: String(err.stack||err).split(/\r\n|\n/gi)});
  }
});

// Endpoints
app.use("/users/v1", userAuth.authEndpoints, usersv1.app);
app.use("/auth/v1", userAuth.authEndpoints, RateLimit({windowMs: 60*1000, max: 10}), authv1.app);

// Backend get errors and send to client.
app.use(({res})=>{res.status(404).json({message: "endpoint no exist."})});
app.use(function (err, req, res, next) {
  res.status(500).json({
    message: "backend crash endpoint, try again in 15 seconds.",
    error: String(err.stack||err).split(/\r\n|\n/gi),
  });
  console.error(err.stack||err);
  return;
});