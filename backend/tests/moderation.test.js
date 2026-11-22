import request from "supertest";
import { createApp } from "../src/app.js";
import adminRouter from "../src/routes/admin.js";
import * as store from "../src/store/itemStore.js";
import { HIDE_AFTER } from "../src/controllers/moderationController.js";

const app = createApp();
const PASSWORD = "test-admin-password";
const ADMIN = { Authorization: `Bearer ${PASSWORD}` };

// Item 1 in the sample data: lost Black iPhone 12
const ID = 1;

function report(id, reporterId, reason = "spam") {
  return request(app).post(`/api/items/${id}/report`).send({ reason, reporterId });
}

// Reports an item from enough different people to hide it
async function hide(id) {
  for (let i = 0; i < HIDE_AFTER; i++) await report(id, `reporter-${i}-xxxx`);
}

beforeEach(async () => {
  await store.reset();
  process.env.ADMIN_TOKEN = PASSWORD;
});

afterAll(() => {
  delete process.env.ADMIN_TOKEN;
});

describe("POST /api/items/:id/report", () => {
  test("saves a report", async () => {
    const res = await report(ID, "person-aaaa", "fake");
    expect(res.status).toBe(201);
    expect(res.body.hidden).toBe(false);
  });

  test("accepts each reason", async () => {
    for (const [i, reason] of ["spam", "fake", "wrong-info"].entries()) {
      expect((await report(i + 1, "person-aaaa", reason)).status).toBe(201);
    }
  });

  test("rejects an unknown reason", async () => {
    const res = await report(ID, "person-aaaa", "ugly");
    expect(res.status).toBe(400);
  });

  test("rejects a missing or too short reporterId", async () => {
    expect((await request(app).post(`/api/items/${ID}/report`).send({ reason: "spam" })).status).toBe(400);
    expect((await report(ID, "abc")).status).toBe(400);
  });

  test("one report per person per listing", async () => {
    await report(ID, "person-aaaa");
    const again = await report(ID, "person-aaaa", "fake");
    expect(again.status).toBe(409);
  });

  test("returns 404 for a missing item", async () => {
    expect((await report(999, "person-aaaa")).status).toBe(404);
  });

  test(`hides a listing after ${HIDE_AFTER} reports`, async () => {
    for (let i = 0; i < HIDE_AFTER - 1; i++) {
      expect((await report(ID, `reporter-${i}-xxxx`)).body.hidden).toBe(false);
    }
    const last = await report(ID, "last-reporter");
    expect(last.body.hidden).toBe(true);
  });
});

describe("hidden listings", () => {
  beforeEach(() => hide(ID));

  test("are not in the public list", async () => {
    const res = await request(app).get("/api/items");
    expect(res.body.map((i) => i.id)).not.toContain(ID);
  });

  test("can't be opened, claimed, marked returned or reported", async () => {
    expect((await request(app).get(`/api/items/${ID}`)).status).toBe(404);
    expect((await request(app).post(`/api/items/${ID}/claim`).send({ answer: "x" })).status).toBe(404);
    expect((await request(app).patch(`/api/items/${ID}/returned`)).status).toBe(404);
    expect((await report(ID, "someone-new")).status).toBe(404);
  });
});

describe("reports stay private", () => {
  test("the public never sees reports or the hidden flag", async () => {
    await report(ID, "person-aaaa");
    const one = await request(app).get(`/api/items/${ID}`);
    const list = await request(app).get("/api/items");
    for (const item of [one.body, list.body.find((i) => i.id === ID)]) {
      expect(item).not.toHaveProperty("reports");
      expect(item).not.toHaveProperty("hidden");
    }
  });
});

describe("admin password", () => {
  // Every admin route, read from the router itself. If someone adds a new
  // admin route and forgets adminOnly, these tests fail.
  const routes = adminRouter.stack
    .filter((layer) => layer.route)
    .flatMap((layer) =>
      Object.keys(layer.route.methods).map((method) => [method, `/api/admin${layer.route.path.replace(":id", ID)}`])
    );

  test("there are admin routes to check", () => {
    expect(routes.length).toBeGreaterThanOrEqual(3);
  });

  test.each(routes)("%s %s refuses without a password", async (method, path) => {
    const res = await request(app)[method](path);
    expect(res.status).toBe(401);
  });

  test.each(routes)("%s %s refuses a wrong password", async (method, path) => {
    const res = await request(app)[method](path).set("Authorization", "Bearer wrong-password");
    expect(res.status).toBe(401);
  });

  test.each(routes)("%s %s is switched off without ADMIN_TOKEN", async (method, path) => {
    delete process.env.ADMIN_TOKEN;
    const res = await request(app)[method](path).set(ADMIN);
    expect(res.status).toBe(503);
  });
});

describe("admin actions", () => {
  test("lists reported listings with counts and reasons, without reporter IDs", async () => {
    await report(ID, "person-aaaa", "spam");
    await report(ID, "person-bbbb", "fake");
    await report(2, "person-aaaa", "spam");

    const res = await request(app).get("/api/admin/reports").set(ADMIN);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    // Most reported first
    expect(res.body[0]).toMatchObject({ id: ID, reportCount: 2, hidden: false, reasons: { spam: 1, fake: 1 } });
    expect(JSON.stringify(res.body)).not.toContain("person-aaaa");
  });

  test("restore shows a hidden listing again and clears its reports", async () => {
    await hide(ID);
    const res = await request(app).post(`/api/admin/items/${ID}/restore`).set(ADMIN);
    expect(res.status).toBe(200);

    expect((await request(app).get(`/api/items/${ID}`)).status).toBe(200);
    expect((await request(app).get("/api/admin/reports").set(ADMIN)).body).toHaveLength(0);
  });

  test("delete removes a listing", async () => {
    const res = await request(app).delete(`/api/admin/items/${ID}`).set(ADMIN);
    expect(res.status).toBe(204);
    expect((await request(app).get(`/api/items/${ID}`)).status).toBe(404);
  });

  test("restore and delete return 404 for a missing item", async () => {
    expect((await request(app).post("/api/admin/items/999/restore").set(ADMIN)).status).toBe(404);
    expect((await request(app).delete("/api/admin/items/999").set(ADMIN)).status).toBe(404);
  });
});
