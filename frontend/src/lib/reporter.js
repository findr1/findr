// Findr has no accounts, so each browser gets a random ID the first time it
// reports something. The API uses it to allow one report per listing.
// If the browser blocks storage, a new ID is made each time.
const KEY = "findr-reporter-id";

function newId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getReporterId() {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = newId();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return newId();
  }
}
