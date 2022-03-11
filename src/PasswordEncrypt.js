const crypto = require("crypto");
const SecretEncrypt = (process.env.PASSWORD_ENCRYPT||"").trim();
if (!SecretEncrypt) {
  console.error("env PASSWORD_ENCRYPT it blank.");
  process.exit(1);
}

module.exports.EncryptPassword = EncryptPassword;
module.exports.DecryptPassword = DecryptPassword;
function EncryptPassword(Password = "") {
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(SecretEncrypt, "salt", 24);
  const cipher = crypto.createCipheriv("aes-192-cbc", key, iv);
  return {
    Encrypt: cipher.update(Password, "utf8", "hex") + cipher.final("hex"),
    iv: iv.toString("hex"),
  }
};

/**
 * Return String with password decrypt.
 * 
 * @param {{iv: string; Encrypt: string;}} passwordObject - Object with iv and Encrypt.
 * @returns {string}
 */
function DecryptPassword(passwordObject) {
  const {iv, Encrypt} = passwordObject;
  if (!iv) throw new Error("iv blank");
  if (!Encrypt) throw new Error("Encrypt blank");
  const key = crypto.scryptSync(SecretEncrypt, "salt", 24);
  const decipher = crypto.createDecipheriv("aes-192-cbc", key, Buffer.from(iv, "hex"));
  return decipher.update(Encrypt, "hex", "utf8") + decipher.final("utf8");
};