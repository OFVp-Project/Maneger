import crypto from "crypto";
const SecretEncrypt = process.env.PASSWORD_SECERET;
if (!SecretEncrypt) {
  console.error("PASSWORD_SECERET is not set");
  process.exit(1);
}

export type passwordEncrypted = {
  Encrypt: string,
  iv: string
};

/**
 * @param password - plain text password to encrypt
 */
export function EncryptPassword(Password: string): passwordEncrypted {
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
 * @param password
 * @returns {string}
 */
export function DecryptPassword(passwordObject: passwordEncrypted): string {
  const {iv, Encrypt} = passwordObject;
  if (!iv) throw new Error("iv blank");
  if (!Encrypt) throw new Error("Encrypt blank");
  const key = crypto.scryptSync(SecretEncrypt, "salt", 24);
  const decipher = crypto.createDecipheriv("aes-192-cbc", key, Buffer.from(iv, "hex"));
  return decipher.update(Encrypt, "hex", "utf8") + decipher.final("utf8");
};

export async function comparePassword(Password: string, passwordObject: passwordEncrypted): Promise<boolean> {
  const password = DecryptPassword(passwordObject);
  return password === Password;
}