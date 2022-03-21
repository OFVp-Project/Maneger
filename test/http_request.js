/** @type {import("axios").default} */
const axios = require("axios");
module.exports.getBuffer = getBuffer;
module.exports.postBuffer = postBuffer;

/**
 * Fetch with method GET
 * @param {string} url 
 * @returns {Promise<{data: Buffer; headers: Headers;}>}
 */
async function getBuffer(url, headers = {}) {
  const response = await axios.get(url, {
    headers: (headers||{}),
    responseType: "arraybuffer",
    reponseEncoding: "binary"
  });
  return {
    data: Buffer.from(response.data),
    headers: response.headers
  };
}

/**
 * 
 * @param {string} url 
 * @param {Array|Object} body 
 * @returns {Promise<{data: Buffer; headers: Headers;}>}
 */
async function postBuffer(url, body, headers = {}) {
  const response = await axios.post(url, body, {
    headers: (headers||{}),
    responseType: "arraybuffer",
    reponseEncoding: "binary"
  });
  return {
    data: Buffer.from(response.data),
    headers: response.headers
  };
}
