import request from "supertest";
import { createApp } from "../src/app.js";
import { createMetricsApp, registry } from "../src/metrics.js";

const app = createApp();
const metricsApp = createMetricsApp();

// Reads /metrics and returns its text
async function readMetrics() {
  const res = await request(metricsApp).get("/metrics");
  expect(res.status).toBe(200);
  return res.text;
}

describe("Prometheus metrics", () => {
  // Start each test with all counters at zero
  beforeEach(() => registry.resetMetrics());

  test("/metrics is not on the public website", async () => {
    const res = await request(app).get("/metrics");
    expect(res.status).toBe(404);
  });

  test("/metrics on the metrics port uses the Prometheus format", async () => {
    const res = await request(metricsApp).get("/metrics");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/plain");
  });

  test("counts requests, with one label for all items", async () => {
    await request(app).get("/api/items/1");
    await request(app).get("/api/items/2");

    const text = await readMetrics();
    expect(text).toContain('findr_http_requests_total{method="GET",route="/api/items/:id",status="200"} 2');
    // No label per item, or Prometheus gets slow
    expect(text).not.toContain('route="/api/items/1"');
  });

  test("counts errors and unknown pages with their status", async () => {
    await request(app).get("/api/does-not-exist");

    const text = await readMetrics();
    expect(text).toContain('findr_http_requests_total{method="GET",route="unmatched",status="404"} 1');
  });

  test("times each request", async () => {
    await request(app).get("/api/health");

    const text = await readMetrics();
    expect(text).toContain('findr_http_request_duration_seconds_count{method="GET",route="/api/health",status="200"} 1');
  });

  test("reports the database as up when it answers", async () => {
    const text = await readMetrics();
    expect(text).toMatch(/^findr_db_up 1$/m);
  });

  test("includes CPU and memory numbers", async () => {
    const text = await readMetrics();
    expect(text).toContain("findr_process_cpu_seconds_total");
    expect(text).toContain("findr_nodejs_heap_size_used_bytes");
  });
});
