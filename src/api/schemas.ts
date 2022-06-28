import express from "express";
import rateLimit from "express-rate-limit";
import * as sshManeger from "../schemas/ssh";
import * as Wireguard from "../schemas/Wireguard";
import * as usersIDs from "../schemas/UserID";
export const schemas = express.Router();

schemas.use(rateLimit({
  max: 500,
  windowMs: 1000 * 60 * 2
}));
schemas.get("/ssh", ({res}) => sshManeger.getUsers().then(res.json));
schemas.get("/wireguard", ({res}) => Wireguard.getUsers().then(res.json));
schemas.get("/usersID", ({res}) => usersIDs.GetUsers().then(res.json));