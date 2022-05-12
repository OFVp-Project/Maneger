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

const stressNumberRandomGem = 500;
/**
 * @param {Array<string>} Files
 */
async function runTest(Files) {
  if (!(fs.existsSync(path.join(__dirname, ".testDir")))) fs.mkdirSync(path.join(__dirname, ".testDir"));
  else {
    fs.rmSync(path.join(__dirname, ".testDir"), { recursive: true });
    fs.mkdirSync(path.join(__dirname, ".testDir"));
  }
  /** @type {{short: Array<{log: string, func:() => Promise<any>}>, long: Array<{log: string, func: (usernames?: Array<string>) => Promise<any>>}}} */
  const toRun = {long: [], short: []};
  for (const file of Files) {
    const logFile = path.join(__dirname, ".testDir", file.replace(path.join(__dirname, "dist"), "").replace(/\/|\\/gi, "_").replace(/\.test\.[tj]s$/, ""), "");
    try {
      /** @type {{main: () => Promise<any>, long: (usernames?: Array<string>) => Promise<any>}} */
      const { main, long } = require(file);
      if (typeof main === "function") toRun.short.push({
        log: logFile+".short",
        func: main
      });
      if (typeof long === "function") toRun.long.push({
        log: logFile+".long",
        func: long
      });
    } catch (err) {
      console.error("Error running file test: %s", file);
      console.error(err);
      console.error();
      fs.writeFileSync(logFile+".log", String(err.stack||err));
    }
  }
  return toRun;
}

if (fs.existsSync(path.join(__dirname, "dist"))) fs.rmSync(path.join(__dirname, "dist"), {recursive: true, force: true});
console.log("Building project");
execSync("npm run build", { stdio: "inherit" });
require("./dist/mongo.js").ConnectionStatus().then(() => {
  return readdirRecursive(path.join(__dirname, "dist"), [/\.test\.js$/]).then(runTest).then(async Runs => {
    await Promise.all(Runs.short.map(({func, log}) => func().then(data => fs.writeFileSync(log+".json", JSON.stringify((data||{}), null, 2))).catch(err => fs.writeFileSync(log+".error.log", String(err.stack||err)))));
    for (const {func, log} of Runs.long) {
      await func(new Array(stressNumberRandomGem).fill(null).map(() => Math.random().toString(36).substring(2, 15))).then(data => fs.writeFileSync(log+".json", JSON.stringify((data||{}), null, 2))).catch(err => {fs.writeFileSync(log+".error.log", String(err.stack||err)); console.error("Error running long test:\n%s", String(err)); return err;});
      console.log("Log file path: %s\n", log);
    }
    console.log("Done");
    process.exit(0);
  });
});