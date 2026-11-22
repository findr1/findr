import express from "express";
import client from "prom-client";
import { pingStore } from "./store/itemStore.js";
import { withTimeout } from "./routes/ready.js";

// All the numbers Prometheus reads from the app. They are served on a
// separate port (see index.js), so they are never on the public website.
export const registry = new client.Registry();

// CPU, memory and other Node.js numbers, with names starting "findr_"
client.collectDefaultMetrics({ register: registry, prefix: "findr_" });

// How many requests the app answered. Errors are the ones with status 5xx.
export const httpRequests = new client.Counter({
  name: "findr_http_requests_total",
  help: "Number of HTTP requests answered",
  labelNames: ["method", "route", "status"],
  registers: [registry],
});

// How long each request took, in seconds
export const httpDuration = new client.Histogram({
  name: "findr_http_request_duration_seconds",
  help: "Time taken to answer HTTP requests, in seconds",
  labelNames: ["method", "route", "status"],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [registry],
});

// 1 when the database answers, 0 when it doesn't. Checked each time
// Prometheus reads the numbers.
new client.Gauge({
  name: "findr_db_up",
  help: "1 if the database answers a ping, 0 if not",
  registers: [registry],
  async collect() {
    try {
      await withTimeout(pingStore(), 2000);
      this.set(1);
    } catch {
      this.set(0);
    }
  },
});

// Gives each request a short page name for the labels, like
// "/api/items/:id" instead of "/api/items/3". One label per item would
// make Prometheus slow.
function routeName(req) {
  if (req.route) return (req.baseUrl + req.route.path).replace(/\/$/, "") || "/";
  return req.originalUrl.startsWith("/api") ? "unmatched" : "static";
}

// Middleware: counts every request and times it once the answer is sent
export function countRequests(req, res, next) {
  const stopTimer = httpDuration.startTimer();
  res.on("finish", () => {
    const labels = { method: req.method, route: routeName(req), status: res.statusCode };
    httpRequests.inc(labels);
    stopTimer(labels);
  });
  next();
}

// A tiny separate app that only serves /metrics. It runs on its own port
// (METRICS_PORT, 9464 by default). The Load Balancer only forwards port 80,
// and the firewall only lets the monitoring VM reach 9464.
export function createMetricsApp() {
  const app = express();
  app.get("/metrics", async (req, res) => {
    res.set("Content-Type", registry.contentType);
    res.send(await registry.metrics());
  });
  return app;
}
