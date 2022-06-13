import crypto from "crypto";
const SecretEncrypt = (process.env.PASSWORD_ENCRYPT||"").trim();
if (!SecretEncrypt) {
  console.error("env PASSWORD_ENCRYPT it blank.");
  process.exit(1);
}

/**
 * @param {string} password
 */
export function EncryptPassword(Password: string): {Encrypt: string; iv: string;} {
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
 * @param {string|{iv: string; Encrypt: string;}} password
 * @returns {string}
 */
export function DecryptPassword(passwordObject: {iv: string; Encrypt: string;}): string {
  const {iv, Encrypt} = passwordObject;
  if (!iv) throw new Error("iv blank");
  if (!Encrypt) throw new Error("Encrypt blank");
  const key = crypto.scryptSync(SecretEncrypt, "salt", 24);
  const decipher = crypto.createDecipheriv("aes-192-cbc", key, Buffer.from(iv, "hex"));
  return decipher.update(Encrypt, "hex", "utf8") + decipher.final("utf8");
};

export async function comparePassword(Password: string, passwordObject: {iv: string; Encrypt: string;}): Promise<boolean> {
  const password = DecryptPassword(passwordObject);
  return password === Password;
}