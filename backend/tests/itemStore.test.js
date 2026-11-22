import { createMemoryStore } from "../src/store/memoryStore.js";
import { createMongoStore } from "../src/store/mongoStore.js";
import { publicItem } from "../src/utils/publicItem.js";

// The same tests run against every store, so the memory store and the
// MongoDB store must behave the same way.
// MongoDB tests only run when MONGODB_URI_TEST is set, for example:
//   MONGODB_URI_TEST=mongodb://localhost:27017/findr-test npm test
// Use a separate test database: the tests delete all items in it.
const stores = [["memory", async () => createMemoryStore()]];
if (process.env.MONGODB_URI_TEST) {
  stores.push(["mongodb", () => createMongoStore(process.env.MONGODB_URI_TEST)]);
}

describe.each(stores)("%s store", (name, createStore) => {
  let store;

  beforeAll(async () => {
    store = await createStore();
  });

  beforeEach(() => store.reset());

  afterAll(() => store.close());

  test("answers a ping when the database is reachable", async () => {
    await expect(store.ping()).resolves.toBeUndefined();
  });

  test("starts with the sample items", async () => {
    expect(await store.getAll()).toHaveLength(6);
  });

  test("finds an item by id, given as a number or a string", async () => {
    expect((await store.getById(1)).title).toBe("Black iPhone 12");
    expect((await store.getById("1")).title).toBe("Black iPhone 12");
    expect(await store.getById(999)).toBeUndefined();
  });

  test("adds new items first, with a new id", async () => {
    const created = await store.add({ title: "Red Umbrella", status: "found" });
    expect(created.id).toBe(7);
    expect(created.returned).toBe(false);
    expect((await store.getAll())[0]).toEqual(created);
  });

  test("gives every new item a different id", async () => {
    const first = await store.add({ title: "Umbrella" });
    const second = await store.add({ title: "Water bottle" });
    expect(second.id).toBe(first.id + 1);
  });

  test("updates an item", async () => {
    const updated = await store.update(2, { returned: true });
    expect(updated.returned).toBe(true);
    expect((await store.getById(2)).returned).toBe(true);
    expect(await store.update(999, { returned: true })).toBeUndefined();
  });

  test("never returns MongoDB's internal _id", async () => {
    const created = await store.add({ title: "Red Umbrella" });
    expect(created._id).toBeUndefined();
    expect((await store.getById(1))._id).toBeUndefined();
    expect((await store.getAll()).every((item) => item._id === undefined)).toBe(true);
  });

  test("saves a report on an item", async () => {
    const result = await store.addReport(1, { reporterId: "a", reason: "spam" });
    expect(result.added).toBe(true);
    expect(result.item.reports).toEqual([{ reporterId: "a", reason: "spam" }]);
    expect((await store.getById(1)).reports).toHaveLength(1);
  });

  test("keeps only one report per reporter", async () => {
    await store.addReport(1, { reporterId: "a", reason: "spam" });
    const again = await store.addReport(1, { reporterId: "a", reason: "fake" });
    expect(again.added).toBe(false);
    await store.addReport(1, { reporterId: "b", reason: "fake" });
    expect((await store.getById(1)).reports.map((r) => r.reporterId)).toEqual(["a", "b"]);
  });

  test("reporting a missing item returns undefined", async () => {
    expect(await store.addReport(999, { reporterId: "a", reason: "spam" })).toBeUndefined();
  });

  test("deletes an item", async () => {
    expect(await store.remove(1)).toBe(true);
    expect(await store.getById(1)).toBeUndefined();
    expect(await store.getAll()).toHaveLength(5);
    expect(await store.remove(1)).toBe(false);
  });
});

describe("publicItem", () => {
  test("hides the answer and contact but keeps the question", async () => {
    const store = createMemoryStore();
    const item = publicItem(await store.getById(2));
    expect(item.answer).toBeUndefined();
    expect(item.contact).toBeUndefined();
    expect(item.question).toBe("What's inside it?");
    expect(item.hasQuestion).toBe(true);
  });
});
