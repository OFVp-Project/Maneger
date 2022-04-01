import { Router as ExpressRoute } from "express";
export const app = ExpressRoute();

const metrics: {
  global: {
    requests: {total: number; success: number; fail: number;};
    response: {time: {min: number; max: number; avg: number;};};
  };
  paths: {
    [path: string]: {
      requests: {total: number; success: number; fail: number;};
      response: {time: {min: number; max: number; avg: number;};};
    }
  }
} = {
  global: {
    requests: {
      total: 0,
      success: 0,
      fail: 0,
    },
    response: {
      time: {
        min: 0,
        max: 0,
        avg: 0,
      }
    }
  },
  paths: {}
};
app.get("/metric", ({res}) => res.json(metrics));
app.use((req, res, next) => {
  res["original_send"] = res.send;
  res["original_sendStatus"] = res.sendStatus;
  const pathReq = req.originalUrl;
  const startTime = Date.now();
  metrics.global.requests.total++;
  if (!metrics.paths[pathReq]) metrics.paths[pathReq] = {requests: {total: 0, success: 0, fail: 0}, response: {time: {min: 0, max: 0, avg: 0 }}}
  res.send = (body) => {
    if (!metrics.paths[pathReq]) metrics.paths[pathReq] = {requests: {total: 0, success: 0, fail: 0}, response: {time: {min: 0, max: 0, avg: 0 }}}
    metrics.paths[pathReq].requests.total++;
    const endTime = Date.now();
    if (res.statusCode === 200) {
      metrics.global.requests.success++;
      metrics.paths[pathReq].requests.success++;
      metrics.global.response.time.min = Math.min(metrics.global.response.time.min, endTime - startTime);
      metrics.global.response.time.max = Math.max(metrics.global.response.time.max, endTime - startTime);
    } else {
      metrics.global.requests.fail++;
      metrics.paths[pathReq].requests.fail++;
    }
    return res["original_send"](body);
  }
  res.sendStatus = (statusCode) => {
    if (!metrics.paths[pathReq]) metrics.paths[pathReq] = {requests: {total: 0, success: 0, fail: 0}, response: {time: {min: 0, max: 0, avg: 0 }}}
    metrics.paths[pathReq].requests.total++;
    const endTime = Date.now();
    if (statusCode === 200) {
      metrics.global.requests.success++;
      metrics.paths[pathReq].requests.success++;
      metrics.global.response.time.min = Math.min(metrics.global.response.time.min, endTime - startTime);
      metrics.global.response.time.max = Math.max(metrics.global.response.time.max, endTime - startTime);
    } else {
      metrics.global.requests.fail++;
      metrics.paths[pathReq].requests.fail++;
    }
    return res["original_sendStatus"](statusCode);
  }
  return next();
});