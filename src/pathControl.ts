export const onStorage = (process.env.NODE_ENV === "development"||process.env.NODE_ENV === "testing") ? process.cwd() : "/data";