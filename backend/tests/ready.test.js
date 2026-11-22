import express from "express";
import request from "supertest";
import { createApp } from "../src/app.js";
import { readyHandler } from "../src/routes/ready.js";

// A small app with only the /ready route, using a fake database check
function appWith(options) {
  const app = express();
  app.get("/api/ready", readyHandler({ name: () => "test", ...options }));
  return app;
}

describe("GET /api/ready", () => {
  test("returns 200 when the database answers", async () => {
    const res = await request(createApp()).get("/api/ready");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ready", storage: "memory" });
  });

  test("returns 503 when the database check fails", async () => {
    const check = async () => {
      throw new Error("connect ECONNREFUSED mongodb://secret-host");
    };
    const res = await request(appWith({ check })).get("/api/ready");
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: "not ready", storage: "test" });
    // The error text must not leak to the user
    expect(JSON.stringify(res.body)).not.toContain("secret-host");
  });

  test("returns 503 when the database takes too long", async () => {
    const check = () => new Promise(() => {}); // never answers
    const res = await request(appWith({ check, timeoutMs: 50 })).get("/api/ready");
    expect(res.status).toBe(503);
    expect(res.body.status).toBe("not ready");
  });
});
