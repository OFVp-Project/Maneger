import mongoose from "mongoose";
import { isDebug } from "./pathControl";
let { MONGO_URL } = process.env;
const urlParse = new URL(MONGO_URL);
if (urlParse.pathname === "/"||!urlParse.pathname) {
  MONGO_URL = ""; MONGO_URL += urlParse.protocol + "//"; MONGO_URL += urlParse.host;
  if (urlParse.username) MONGO_URL += urlParse.username; if (urlParse.password) MONGO_URL += ":" + urlParse.password;
  if (!!urlParse.username || !!urlParse.password) MONGO_URL += "@";
  MONGO_URL += "/ofvp";
}
if (isDebug) console.log("[MongoDB] Connecting to %s", MONGO_URL);

// Create connection
export const Connection = mongoose.createConnection(MONGO_URL, {
  autoIndex: true,
  compressors: "zlib",
  serializeFunctions: true,
  zlibCompressionLevel: 9
});
Connection.set("maxTimeMS", 30 * 1000);
let statusLocal: string|Error = undefined
Connection.on("error", err => statusLocal = err);
Connection.on("connected", () => statusLocal = "connected");

/**
 * Get Users Database Connection Status
 * @returns {Promise<void>}
 */
export function ConnectionStatus() {
  if (statusLocal === "connected") return Promise.resolve();
  else if (statusLocal === undefined) {
    return new Promise<void>((resolve, reject) => {
      Connection.on("error", reject);
      Connection.on("connected", () => resolve());
    });
  }
  return Promise.reject(statusLocal);
}