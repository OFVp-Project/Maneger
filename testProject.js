#!/usr/bin/env node
process.env.PASSWORD_ENCRYPT = "password";
process.env.NODE_ENV = "development";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

/**
 * Read dir recursively
 *
 * @param {string} dir
 * @param {Array<RegExp>} filterFile
 * @returns {Promise<Array<string>>}
 */
async function readdirRecursive(dir, filterFile) {
  if (!fs.existsSync(dir)) throw new Error(`Directory not found: ${dir}`);
  if (!(fs.statSync(dir).isDirectory())) return [dir];
  if (!filterFile) filterFile = [];
  /** @type {Array<string>} */
  const files = [];
  /** @type {Array<string>} */
  const dirs = fs.readdirSync(dir);
  for (const d of dirs) {
    const dirPath = path.resolve(dir, d);
    if (fs.statSync(dirPath).isDirectory()) files.push(...(await readdirRecursive(dirPath, filterFile)));
    else {
      if (filterFile.length <= 0) files.push(dirPath);
      else {
        if (filterFile.some(f => f.test(d))) files.push(dirPath);
      }
    }
  }
  return files;
}

const stressNumberRandomGem = 1000;

/**
 * @param {Array<string>} Files
 */
async function runTest(Files) {
  if (!(fs.existsSync(path.join(__dirname, ".testDir")))) fs.mkdirSync(path.join(__dirname, ".testDir"));
  else {
    fs.rmSync(path.join(__dirname, ".testDir"), { recursive: true });
    fs.mkdirSync(path.join(__dirname, ".testDir"));
  }
  let haveError = false;
  for (const file of Files) {
    const logFile = path.join(__dirname, ".testDir", file.replace(path.join(__dirname, "dist"), "").replace(/\/|\\/gi, "_").replace(/\.test\.[tj]s$/, ""), "");
    let shortRes = {}, longRes = {};
    try {
      /** @type {{main: () => Promise<any>, long: (usernames?: Array<string>) => Promise<any>}} */
      const { main, long } = require(file);
      console.log("Running file test: %s", file);
      if (typeof main === "function") {
        const shortStart = new Date();
        shortRes = await main();
        const shortEnd = new Date();
        console.log("Short test finished in %sms", shortEnd.getTime() - shortStart.getTime());
      }
      if (typeof long === "function") {
        const longStart = new Date();
        const usernames = (() => {const arr = []; for (let i = 1; i <= stressNumberRandomGem; i++) arr.push(Buffer.from((Math.random()*255).toString()).toString("hex")); return arr;})();
        longRes = await long(usernames);
        const longEnd = new Date();
        console.log("Long test finished in %sms", longEnd.getTime() - longStart.getTime());
      }
      fs.writeFileSync(logFile+".json", JSON.stringify({shortRes, longRes}, null, 2));
    } catch (err) {
      console.error("Error running file test: %s", file);
      console.error(err);
      console.error();
      fs.writeFileSync(logFile+".log", String(err.stack||err));
      haveError = true;
    }
  }
  console.log("Test finished");
  process.exit(haveError ? 1 : 0);
}

if (fs.existsSync(path.join(__dirname, "dist"))) fs.rmSync(path.join(__dirname, "dist"), {recursive: true, force: true});
console.log("Building project");
execSync("npm run build", { stdio: "inherit" });
require("./dist/mongo.js").ConnectionStatus().then(() => {
  return readdirRecursive(path.join(__dirname, "dist"), [/\.test\.js$/]).then(runTest);
});