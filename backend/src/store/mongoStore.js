import { MongoClient } from "mongodb";
import { seedItems } from "../data/seedItems.js";

// Never send MongoDB's own _id to the rest of the app. We use our own
// numeric id, so item links like /items/3 stay short and work the same
// as with the memory store.
const HIDE_MONGO_ID = { projection: { _id: 0 } };

// Connects to MongoDB and returns a store with the same functions as the
// memory store. Adds the sample items the first time the database is empty.
export async function createMongoStore(uri) {
  const client = new MongoClient(uri);
  await client.connect();

  const db = client.db();
  const items = db.collection("items");
  const counters = db.collection("counters");

  await items.createIndex({ id: 1 }, { unique: true });

  // Gives every new item the next number: 7, 8, 9...
  async function nextId() {
    const counter = await counters.findOneAndUpdate(
      { _id: "items" },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: "after" }
    );
    return counter.seq;
  }

  // Makes sure the counter starts after the highest id already saved
  async function syncCounter() {
    const [last] = await items.find({}, HIDE_MONGO_ID).sort({ id: -1 }).limit(1).toArray();
    await counters.updateOne({ _id: "items" }, { $max: { seq: last?.id ?? 0 } }, { upsert: true });
  }

  async function reset(data = seedItems) {
    await items.deleteMany({});
    await counters.deleteMany({});
    if (data.length) await items.insertMany(data.map((item) => ({ returned: false, ...item })));
    await syncCounter();
  }

  async function getAll() {
    // Newest first, like the memory store
    return items.find({}, HIDE_MONGO_ID).sort({ id: -1 }).toArray();
  }

  async function getById(id) {
    return (await items.findOne({ id: Number(id) }, HIDE_MONGO_ID)) ?? undefined;
  }

  async function add(item) {
    const created = { ...item, id: await nextId(), returned: false };
    // insertOne adds _id to the object it is given, so give it a copy
    await items.insertOne({ ...created });
    return created;
  }

  async function update(id, changes) {
    const updated = await items.findOneAndUpdate(
      { id: Number(id) },
      { $set: changes },
      { returnDocument: "after", ...HIDE_MONGO_ID }
    );
    return updated ?? undefined;
  }

  // Saves a report on an item. One report per reporter. The check and the
  // save happen in one step, so two quick clicks can't add two reports.
  // Returns undefined if the item doesn't exist, otherwise { item, added }.
  async function addReport(id, report) {
    const updated = await items.findOneAndUpdate(
      { id: Number(id), "reports.reporterId": { $ne: report.reporterId } },
      { $push: { reports: report } },
      { returnDocument: "after", ...HIDE_MONGO_ID }
    );
    if (updated) return { item: updated, added: true };
    const item = await getById(id);
    return item ? { item, added: false } : undefined;
  }

  // Deletes an item for good. Returns true if it existed.
  async function remove(id) {
    const result = await items.deleteOne({ id: Number(id) });
    return result.deletedCount > 0;
  }

  async function close() {
    await client.close();
  }

  // Asks the database to answer. Throws if it can't be reached.
  async function ping() {
    await db.command({ ping: 1 });
  }

  if ((await items.countDocuments()) === 0) {
    await reset();
  } else {
    await syncCounter();
  }

  return { name: "mongodb", reset, getAll, getById, add, update, addReport, remove, close, ping };
}
