import mongoose from "mongoose";
let { MongoDB_URL } = process.env;
if (!MongoDB_URL) MongoDB_URL = "mongodb://localhost:27017";
if (!/:\/\/.*\//.test(MongoDB_URL)) MongoDB_URL = MongoDB_URL+"/OFVpServer";

// Create connection
export const Connection = mongoose.createConnection(MongoDB_URL, {
  maxPoolSize: 400,
  minPoolSize: 5,
  autoIndex: true,
  compressors: "zlib",
  serializeFunctions: true,
  zlibCompressionLevel: 9
});
Connection.set("maxTimeMS", 3 * 1000);

/**
 * @type {Status: "Connecting"|"Connected"|"Error"; Error: null|Error;}
 */
const ConnectionStatusObject = {Status: "Connecting", Error: null};
Connection.on("connected", () => {
  ConnectionStatusObject.Status = "Connected";
  ConnectionStatusObject.Error = null;
});
Connection.on("error", err => {
  ConnectionStatusObject.Status = "Error";
  ConnectionStatusObject.Error = err;
  console.error("Error to connect in MongoDB", err);
});

/**
 * Get Users Database Connection Status
 * @returns {Promise<ConnectionStatusObject>}
 */
export async function ConnectionStatus() {
  while (true) {
    if (ConnectionStatusObject.Status === "Connected") return;
    if (ConnectionStatusObject.Status === "Error") throw ConnectionStatusObject.Error;
    if (ConnectionStatusObject.Status !== "Connecting") throw new Error("Users MongoDB Error in Connection");
    await new Promise(res => setTimeout(res, 500));
  }
}