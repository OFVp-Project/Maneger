import { Schema, createConnection } from "mongoose";
let { MongoDB_URL } = process.env;
if (!MongoDB_URL) MongoDB_URL = "mongodb://localhost:27017";
if (!/:\/\/.*\//.test(MongoDB_URL)) MongoDB_URL = MongoDB_URL+"/OFVpServer";

// Create connection
export const Connection = createConnection(MongoDB_URL, {
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

export const UsersSchema = Connection.model("Users", new Schema({
  // Basic Info
  username: {
    type: String,
    required: true,
    unique: true
  },
  expire: {
    type: String,
    required: true
  },
  password: {
    iv: {
      type: String,
      required: true
    },
    Encrypt: {
      type: String,
      required: true
    }
  },
  // SSH
  ssh: {
    connections: {
      type: Number,
      required: true
    }
  },
  // Wireguard Config
  wireguard: [
    {
      keys: {
        Preshared: {
          type: String,
          unique: true,
          required: true
        },
        Private: {
          type: String,
          unique: true,
          required: true
        },
        Public: {
          type: String,
          unique: true,
          required: true
        }
      },
      ip: {
        v4: {
          ip: {
            type: String,
            unique: true,
            required: true
          },
          mask: {
            type: String,
            required: true
          }
        },
        v6: {
          ip: {
            type: String,
            unique: true,
            required: true
          },
          mask: {
            type: String,
            required: true
          }
        }
      }
    }
  ]
}, {
  versionKey: false,
  autoIndex: true,
  bufferCommands: false,
}));

export const authSchema = Connection.model("AuthToken", new Schema({
  // E-Mail Token
  token: {
    type: String,
    required: true,
    unique: true
  },
  // E-Mail
  email: {
    type: String,
    required: true,
    unique: true
  },
  // Password
  password: {
    iv: {
      type: String,
      required: true
    },
    Encrypt: {
      type: String,
      required: true
    }
  },
  privilages: {
    type: String,
    default: "user"
  },
  createdAt: {
    type: String,
    default: () => (new Date).toString()
  }
}, {
  versionKey: false,
  autoIndex: true,
  bufferCommands: false,
}));