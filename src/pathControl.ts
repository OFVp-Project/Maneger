export const isDebug = (process.env.NODE_ENV === "development"||process.env.NODE_ENV === "testing");
export const onStorage = isDebug ? process.cwd() : "/data";
export const emailValidate = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;