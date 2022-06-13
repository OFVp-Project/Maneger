import mongoose from "mongoose";
if (process.env.MongoDB_URL) process.env.MONGO_URL = process.env.MongoDB_URL;
let { MONGO_URL } = process.env;
if (!MONGO_URL) {
  console.log("[MongoDB] No MongoDB URL provided");
  process.exit(1);
}
const urlParse = new URL(MONGO_URL);
if (!urlParse.pathname) MONGO_URL += "/OFVpServer"; else if (urlParse.pathname === "/") MONGO_URL += "OFVpServer";
if (process.env.NODE_ENV === "development"||process.env.NODE_ENV === "testing") console.log("[MongoDB] Connecting to %s", MONGO_URL);

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