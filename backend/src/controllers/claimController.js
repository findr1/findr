// Owner: Bonae
// POST  /api/items/:id/claim     Claim an item by answering its question
// PATCH /api/items/:id/returned  Mark an item as returned

import * as store from "../store/itemStore.js";
import { publicItem } from "../utils/publicItem.js";

// Stops people from guessing the answer again and again
export const MAX_ATTEMPTS = 5;

// "  Laptop  CHARGER " and "laptop charger" count as the same answer
function normalize(text) {
  return String(text).trim().toLowerCase().replace(/\s+/g, " ");
}

export async function claimItem(req, res) {
  const item = await store.getById(req.params.id);
  if (!item || item.hidden) {
    return res.status(404).json({ error: "Item not found" });
  }
  if (item.status !== "found" || !item.question) {
    return res.status(400).json({ error: "Only found items with a question can be claimed" });
  }
  if (item.returned) {
    return res.status(409).json({ error: "This item has already been returned" });
  }

  const attempts = item.claimAttempts || 0;
  if (attempts >= MAX_ATTEMPTS) {
    return res.status(429).json({ error: "Too many wrong answers. Contact campus security." });
  }

  const answer = req.body?.answer;
  if (typeof answer !== "string" || !answer.trim()) {
    return res.status(400).json({ error: "Answer is required" });
  }

  if (normalize(answer) !== normalize(item.answer)) {
    await store.update(item.id, { claimAttempts: attempts + 1 });
    return res.status(403).json({
      error: "That answer is not correct",
      attemptsLeft: MAX_ATTEMPTS - attempts - 1,
    });
  }

  res.json({ message: "Correct! Contact the finder to get your item back.", contact: item.contact });
}

export async function markReturned(req, res) {
  const item = await store.getById(req.params.id);
  if (!item || item.hidden) {
    return res.status(404).json({ error: "Item not found" });
  }
  if (item.returned) {
    return res.status(409).json({ error: "This item has already been returned" });
  }

  const updated = await store.update(item.id, { returned: true, returnedAt: new Date().toISOString() });
  res.json(publicItem(updated));
}
