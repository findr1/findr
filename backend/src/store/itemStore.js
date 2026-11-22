import { createMemoryStore } from "./memoryStore.js";
import { createMongoStore } from "./mongoStore.js";

// The one place the rest of the app gets items from. Every function returns
// a promise, so callers always use await, whichever store is active.
// Starts with the memory store; initStore() switches to MongoDB when
// MONGODB_URI is set.
let store = createMemoryStore();

export async function initStore(uri = process.env.MONGODB_URI) {
  if (uri) store = await createMongoStore(uri);
  return store.name;
}

export const reset = (...args) => store.reset(...args);
export const getAll = () => store.getAll();
export const getById = (id) => store.getById(id);
export const add = (item) => store.add(item);
export const update = (id, changes) => store.update(id, changes);
export const closeStore = () => store.close();
export const pingStore = () => store.ping();
export const storeName = () => store.name;
