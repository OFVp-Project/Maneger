module.exports.getBuffer = getBuffer;
module.exports.postBuffer = postBuffer;

/**
 * Fetch with method GET
 * @param {string} url 
 * @returns {Promise<{data: Buffer; headers: Headers;}>}
 */
async function getBuffer(url, headers = {}) {
  const NodeFetch = (await import("node-fetch")).default;
  const response = await NodeFetch(url, {
    method: "GET",
    headers: headers||{}
  });
  if (response.ok) return {
    data: Buffer.from(await response.arrayBuffer()),
    headers: response.headers
  };
  throw {
    data: Buffer.from(await response.arrayBuffer()),
    headers: response.headers
  }
}

/**
 * 
 * @param {string} url 
 * @param {Array|Object} body 
 * @returns {Promise<{data: Buffer; headers: Headers;}>}
 */
async function postBuffer(url, body, headers = {}) {
  const NodeFetch = (await import("node-fetch")).default;
  const response = await NodeFetch(url, {
    method: "POST",
    body: JSON.stringify(body||{}),
    headers: {
      "Content-Type": "application/json",
      ...(headers||{})
    },
  });
  if (response.ok) return {
    data: Buffer.from(await response.arrayBuffer()),
    headers: response.headers
  };
  throw {
    data: Buffer.from(await response.arrayBuffer()),
    headers: response.headers
  }
}