import cliColor from "cli-color";
console.log
if (process.env.NOCOLOR !== "1") {
  const originalLog = console.log;
  console.log = function (...args: any[]) {
    originalLog(...args.map(x => typeof x === "string" ? cliColor.blue(x) : x));
  }
  const originalError = console.error;
  console.error = function (...args: any[]) {
    originalError(...args.map(x => typeof x === "string" ? cliColor.red(x) : x));
  }
  const originalInfo = console.info;
  console.info = function (...args: any[]) {
    originalInfo(...args.map(x => typeof x === "string" ? cliColor.yellow(x) : x));
  }
  const originalWarn = console.warn;
  console.warn = function (...args: any[]) {
    originalWarn(...args.map(x => typeof x === "string" ? cliColor.redBright(x) : x));
  }
  const originalDebug = console.debug;
  console.debug = function (...args: any[]) {
    originalDebug(...args.map(x => typeof x === "string" ? cliColor.magenta(x) : x));
  }
}