import cliColor from "cli-color";
if (process.env.NOCOLOR !== "1") {
  const originalLog = console.log;
  const originalError = console.error;
  const originalInfo = console.info;
  const originalWarn = console.warn;
  const originalDebug = console.debug;
  console.log = function (...args: any[]) {
    originalLog(...args.map(x => typeof x === "string" ? cliColor.blue(x) : x));
  }
  console.error = function (...args: any[]) {
    originalError(...args.map(x => typeof x === "string" ? cliColor.red(x) : x));
  }
  console.info = function (...args: any[]) {
    originalInfo(...args.map(x => typeof x === "string" ? cliColor.yellow(x) : x));
  }
  console.warn = function (...args: any[]) {
    originalWarn(...args.map(x => typeof x === "string" ? cliColor.redBright(x) : x));
  }
  console.debug = function (...args: any[]) {
    originalDebug(...args.map(x => typeof x === "string" ? cliColor.magenta(x) : x));
  }
}