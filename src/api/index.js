const http = require("http");
const express = require("express");
const SocketIo = require("socket.io");

// Express and Socket.io
const app = express();
module.exports.app = app;
const Server = http.createServer(app);
Server.listen(3000, () => console.info("API listen in port 3000"));
module.exports.Server = Server;
const io = new SocketIo.Server(Server);
module.exports.io = io;

// Express middlewares
const BodyParse = require("body-parser");
const cors = require("cors");
const ExpressSession = require("express-session");
const MongoStore = require('connect-mongo');

app.use(cors());
app.use(BodyParse.urlencoded({extended: true}));
app.use(BodyParse.json());
app.use((req, res, next) => {
  res.json = (body) => {
    if (!res.get("Content-Type")) {
      res.set("Content-Type", "application/json");
    }
    res.send(JSON.stringify(body, (key, value) => typeof value === "bigint" ? value.toString() : value, 2));
  }
  return next();
});
app.use((req, res, next) => {
  const Redirect = (req.body.redirect || req.query.redirect || req.headers.redirect);
  const host = (req.headers.host||req.headers.Host||req.headers.hostname||req.headers.Hostname).replace(/\:.*/, "");
  if (Redirect === ""||Redirect === undefined) return next();
  if (Redirect.startsWith("/")) return next();
  if (Redirect.startsWith(`${req.method}://${host}`)) return next();
  res.status(301).json({
    error: "invalid redirect",
    redirect: Redirect
  });
});
if (!process.env.COOKIE_SECRET) throw new Error("COOKIE_SECRET is not defined");
let { MongoDB_URL } = process.env;
if (!/:\/\/.*\//.test(MongoDB_URL)) MongoDB_URL = MongoDB_URL+"/OFVpServer";
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
  store: MongoStore.create({
    mongoUrl: MongoDB_URL,
    collectionName: "CookieSessions",
    // autoRemove: "disabled",
    autoRemove: "native",
    crypto: {
      secret: (process.env.PASSWORD_ENCRYPT||"").trim()
    }
  })
}));

// API routes
const { checkAuth } = require("../mongo/Schemas/auth");
const userAuth = require("./auth");
const RateLimit = (require("express-rate-limit")).default;
app.post("/login", RateLimit({windowMs: 1*60*1000, max: 5}), async (req, res) => {
  const { Email, Password, redirect: Redirect } = req.body;
  var ConnectedStatus = false;
  try {
    const userData = await checkAuth(Email, Password);
    if (userData) {
      req.session.email = Email;
      req.session.password = userData.password;
      await new Promise((resolve, reject) => req.session.save(err => {if(err) return reject(err);resolve()}));
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
  const {redirect: Redirect} = req.body;
  try {
    await new Promise((resolve, reject) => req.session.destroy(err => {if(err) return reject(err);resolve()}));
    return res.sendStatus(200);
  } catch (err) {
    console.log(String(err.stack||err));
    return res.sendStatus(400).json({error: String(err.stack||err).split(/\r\n|\n/gi)});
  }
});

// Endpoints
// Users
const usersV3 = require("./v3/users");
app.use("/users/v3", userAuth.authEndpoints, usersV3.app);
app.use("/users", ({res}) => res.status(400).json({message: "set endpoint version, check wiki: https://github.com/OFVp-Project/DeamonManeger/wiki/Users"}));

// Auth
const authV3 = require("./v3/auth");
app.use("/auth/v3", userAuth.authEndpoints, RateLimit({windowMs: 60*1000, max: 10, skip: true}), authV3.app);
app.use("/auth", ({res}) => res.status(400).json({message: "set endpoint version, check wiki: https://github.com/OFVp-Project/DeamonManeger/wiki/Auth"}));

// Backend get errors and send to client.
app.use(({res})=>{res.status(404).json({message: "endpoint no exist."})});
app.use(function (err, req, res, next) {
  res.status(500).json({
    message: "backend crash endpoint, try again in 15 seconds.",
    error: String(err.stack||err).split(/\r\n|\n/gi),
  });
  console.debug(err.stack||err);
  return;
});

// Socket.io Auth
io.use(async function (socket, next) {
  const { headers, query, auth } = socket.handshake;
  const AuthToken = headers["AuthorizationAuth"] || query["auth"] || query["Auth"] || auth["token"] || auth["auth"];
  const Authss = [];
  if (AuthToken) {if ((function (JsonS = "{}") {try {JSON.parse(JsonS);return true;} catch (err) {return false;}})(AuthToken)) {
      const TokenData = JSON.parse(AuthToken);
      Authss.push(TokenData.email || TokenData.Email, TokenData.password || TokenData.Password);
    } else if (AuthToken.email && AuthToken.password) Authss.push(AuthToken.email, AuthToken.password); else Authss.push(AuthToken);
    try {
      const Auths = await (require("../auth")).CheckGetToken(...Authss)
      if (Auths) {
        socket.ofvp_auth = Auths;
        return next();
      }
    } catch (err) {
      return next(err);
    }
  }
  return next(new Error("Token is not valid"));
});
