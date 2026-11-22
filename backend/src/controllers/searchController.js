// Owner: Gloire
// GET /api/items?status=lost&category=phone&location=Library
//
// Filters (all optional, can be combined):
//   status    lost | found
//   category  exact match, e.g. electronics
//   location  partial match, e.g. "room" finds "Maputo Room"
//   date      exact day, YYYY-MM-DD
//   returned  true | false
//   q         words to look for in the title, location and description

import * as store from "../store/itemStore.js";
import { publicItem } from "../utils/publicItem.js";

const STATUSES = ["lost", "found"];

// Reads one query value as lowercase trimmed text.
// Missing values (or repeated ones like ?status=a&status=b) count as empty.
function read(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export async function listItems(req, res) {
  const status = read(req.query.status);
  const category = read(req.query.category);
  const location = read(req.query.location);
  const date = read(req.query.date);
  const returned = read(req.query.returned);
  const q = read(req.query.q);

  if (status && !STATUSES.includes(status)) {
    return res.status(400).json({ error: "Status must be 'lost' or 'found'" });
  }
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "Date must be in the format YYYY-MM-DD" });
  }
  if (returned && returned !== "true" && returned !== "false") {
    return res.status(400).json({ error: "Returned must be 'true' or 'false'" });
  }

  const results = (await store.getAll()).filter((item) => {
    // Listings hidden after reports are not shown until an admin checks them
    if (item.hidden) return false;
    if (status && item.status !== status) return false;
    if (category && String(item.category).toLowerCase() !== category) return false;
    if (location && !String(item.location).toLowerCase().includes(location)) return false;
    if (date && item.date !== date) return false;
    if (returned && String(item.returned) !== returned) return false;
    if (q) {
      const text = `${item.title} ${item.location} ${item.description || ""}`.toLowerCase();
      if (!text.includes(q)) return false;
    }
    return true;
  });

  res.json(results.map(publicItem));
}