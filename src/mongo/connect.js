const { MongoDB_URL } = process.env;
if (!MongoDB_URL) throw new Error("Invalid MongoDB URL");
const Mongoose = require("mongoose");
const Connection = Mongoose.createConnection(`${MongoDB_URL}/OFVpServer`);
module.exports.Connection = Connection;
const daemon = require("../daemon/connect");
/**
 * @type {Status: "Connecting"|"Connected"|"Error"; Error: null|Error;}
 */
const ConnectionStatusObject = {Status: "Connecting", Error: null};
Connection.on("connected", () => {
  ConnectionStatusObject.Status = "Connected";
  ConnectionStatusObject.Error = null;
  daemon.io.emit("monngoConnection", "Connected");
});
Connection.on("error", err => {
  ConnectionStatusObject.Status = "Error";
  ConnectionStatusObject.Error = err;
  console.error("Error to connect in MongoDB", err);
  daemon.io.emit("monngoConnection", err);
});

/**
 * Get Users Database Connection Status
 * @returns {Promise<ConnectionStatusObject>}
 */
module.exports.ConnectionStatus = async () => {
  while (true) {
    if (ConnectionStatusObject.Status === "Connected") return;
    if (ConnectionStatusObject.Status === "Error") throw ConnectionStatusObject.Error;
    if (ConnectionStatusObject.Status !== "Connecting") throw new Error("Users MongoDB Error in Connection");
    await new Promise(res => setTimeout(res, 500));
  }
}