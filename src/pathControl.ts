export const isDebug = (process.env.NODE_ENV === "development"||process.env.NODE_ENV === "testing");
export const onStorage = isDebug ? process.cwd() : "/data";