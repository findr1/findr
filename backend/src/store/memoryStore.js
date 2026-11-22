import { seedItems } from "../data/seedItems.js";

// Keeps items in memory. Used by the tests and when no MONGODB_URI is set.
// Data is lost when the server stops.
export function createMemoryStore() {
  let items = [];
  let nextId = 1;

  async function reset(data = seedItems) {
    items = data.map((item) => ({ returned: false, ...item }));
    nextId = Math.max(0, ...items.map((item) => item.id)) + 1;
  }

  async function getAll() {
    return items;
  }

  async function getById(id) {
    return items.find((item) => item.id === Number(id));
  }

  async function add(item) {
    const created = { ...item, id: nextId++, returned: false };
    items.unshift(created);
    return created;
  }

  async function update(id, changes) {
    const item = await getById(id);
    if (!item) return undefined;
    Object.assign(item, changes);
    return item;
  }

  // Saves a report on an item. One report per reporter: a second report
  // from the same reporterId is not added.
  // Returns undefined if the item doesn't exist, otherwise { item, added }.
  async function addReport(id, report) {
    const item = await getById(id);
    if (!item) return undefined;
    item.reports ??= [];
    if (item.reports.some((r) => r.reporterId === report.reporterId)) return { item, added: false };
    item.reports.push(report);
    return { item, added: true };
  }

  // Deletes an item for good. Returns true if it existed.
  async function remove(id) {
    const index = items.findIndex((item) => item.id === Number(id));
    if (index === -1) return false;
    items.splice(index, 1);
    return true;
  }

  async function close() {}

  // Memory is always there, so the memory store is always ready
  async function ping() {}

  reset();

  return { name: "memory", reset, getAll, getById, add, update, addReport, remove, close, ping };
}
