import path from "path";
import http from "http";
import express from "express";
import SocketIo from "socket.io";
import RateLimit from "express-rate-limit";
import BodyParse from "body-parser";
import cors from "cors";
import ExpressSession, { Session } from "express-session";
import sessionStore from "session-file-store";
import * as Auth from "../model/auth";
import * as userAuth from "./auth";
import * as usersv1 from "./v1/users";
import * as authv1 from "./v1/auth";
import * as metric from "./metric";

// Express and Socket.io
export const app = express();
export const Server = http.createServer(app);
export const io = new SocketIo.Server(Server);
export const session = Session;
const storagePath = (process.env.NODE_ENV === "development"||process.env.NODE_ENV === "testing")? process.cwd():"/data";

declare module "express-session" {
  interface Session {
    Session;
    email: string;
    password: string|{iv: string; Encrypt: string;};
  }
}

app.use(cors());
app.use(BodyParse.urlencoded({extended: true}));
app.use(BodyParse.json());
app.use(({res, next}) => {
  res.json = (body) => {
    if (!res.get("Content-Type")) {
      res.set("Content-Type", "application/json");
    }
    res.send(JSON.stringify(body, (key, value) => typeof value === "bigint" ? value.toString() : value, 2));
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

// Socket.io Auth
io.use(async function (socket, next) {
  const { auth } = socket.handshake;
  if (!auth) return next(new Error("auth is not defined"));
  if (!auth.email) return next(new Error("auth.email is not defined"));
  if (!auth.password) return next(new Error("auth.password is not defined"));
  if (typeof auth.email !== "string") return next(new Error("auth.email is not a string"));
  if (typeof auth.password !== "string") return next(new Error("auth.password is not a string"));
  if (!!(await Auth.checkAuth(auth.email, auth.password))) return next();
  return next(new Error("Token is not valid"));
});
