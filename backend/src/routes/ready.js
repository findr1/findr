import { pingStore, storeName } from "../store/itemStore.js";

// How long to wait for the database before saying "not ready"
const TIMEOUT_MS = 2000;

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("Database did not answer in time")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Returns 200 when the database answers, 503 when it doesn't.
// check and name can be replaced in tests.
export function readyHandler({ check = pingStore, name = storeName, timeoutMs = TIMEOUT_MS } = {}) {
  return async (req, res) => {
    try {
      await withTimeout(Promise.resolve().then(check), timeoutMs);
      res.json({ status: "ready", storage: name() });
    } catch {
      // Don't send the error itself: it can contain the database address
      res.status(503).json({ status: "not ready", storage: name() });
    }
  };
}
