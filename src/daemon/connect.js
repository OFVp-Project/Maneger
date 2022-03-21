const fs = require("fs");
const path = require("path");
const http_requests = require("../http_request");
const { DAEMON_PASSWORD="", DAEMON_USER="", WIREGUARD_ENDPOINT_HOST="", WIREGUARD_ENDPOINT_PORT="3001", OPENSSH_ENDPOINT_HOST="", OPENSSH_ENDPOINT_PORT="3002" } = process.env;
const UserMongo = require("../mongo/Schemas/users");
const { getWireguardip } = require("../mongo/Schemas/WireguardIpmaneger");

// Wireguard
if (!!WIREGUARD_ENDPOINT_HOST && !!WIREGUARD_ENDPOINT_PORT) {
  UserMongo.on(async () => {
    http_requests.postBuffer(`http://${WIREGUARD_ENDPOINT_HOST}:${WIREGUARD_ENDPOINT_PORT}/v1/init`, {
      users: await UserMongo.getUsers(),
      WireguardIpConfig: {
        keys: (() => {
          const storage = process.env.NODE_ENV === "development"? process.cwd():"/data";
          if (fs.existsSync(resolve(storage, "wireguardInterface.json"))) return JSON.parse(fs.readFileSync(resolve(storage, "wireguardInterface.json"), "utf8"));
          const keys = mongoUser.CreateWireguardKeys();
          fs.writeFileSync(resolve(storage, "wireguardInterface.json"), JSON.stringify(keys, null, 2));
          return keys;
        })(),
        ip: await getWireguardip()
      }
    }, {
      daemon_password: DAEMON_PASSWORD,
      daemon_user: DAEMON_USER
    });
  });
}

// OpenSSH
if (!!OPENSSH_ENDPOINT_HOST && !!OPENSSH_ENDPOINT_PORT) {
  UserMongo.on(async (operation, document) => {
    http_requests.postBuffer(`http://${OPENSSH_ENDPOINT_HOST}:${OPENSSH_ENDPOINT_PORT}/v1/update/${operation}`, document, {daemon_password: DAEMON_PASSWORD, daemon_user: DAEMON_USER});
    http_requests.postBuffer(`http://${OPENSSH_ENDPOINT_HOST}:${OPENSSH_ENDPOINT_PORT}/v1/init`, await UserMongo.getUsersDecrypt(), {daemon_password: DAEMON_PASSWORD, daemon_user: DAEMON_USER});
  });
}
