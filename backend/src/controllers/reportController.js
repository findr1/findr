// Owner: Gloire
// POST /api/items      Report a lost or found item
// GET  /api/items/:id  Get one item

import * as store from "../store/itemStore.js";
import { publicItem } from "../utils/publicItem.js";

const STATUSES = ["lost", "found"];

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

// Accepts only real dates written as YYYY-MM-DD, e.g. 2026-10-22
function isValidDate(text) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
}

// Returns { error } if something is wrong, or { data } with the cleaned item.
// Only the fields we expect are copied, so a client cannot set id or returned.
function validate(body) {
  const title = clean(body.title);
  const category = clean(body.category).toLowerCase();
  const status = clean(body.status).toLowerCase();
  const location = clean(body.location);
  const date = clean(body.date);
  const contact = clean(body.contact);
  const description = clean(body.description);

  if (!title) return { error: "Title is required" };
  if (title.length > 100) return { error: "Title must be 100 characters or less" };
  if (!category) return { error: "Category is required" };
  if (!STATUSES.includes(status)) return { error: "Status must be 'lost' or 'found'" };
  if (!location) return { error: "Location is required" };
  if (!date) return { error: "Date is required" };
  if (!isValidDate(date)) return { error: "Date must be a real date in the format YYYY-MM-DD" };
  if (!contact) return { error: "Contact is required" };
  if (contact.length > 50) return { error: "Contact must be 50 characters or less" };
  if (description.length > 500) return { error: "Description must be 500 characters or less" };

  const data = { title, category, status, location, date, contact };
  if (description) data.description = description;

  // Found items need a private question so the real owner can be verified
  if (status === "found") {
    const question = clean(body.question);
    const answer = clean(body.answer);
    if (!question) return { error: "Found items need a verification question" };
    if (!answer) return { error: "Found items need the answer to the verification question" };
    data.question = question;
    data.answer = answer;
  }

  return { data };
}

export async function createItem(req, res) {
  const { error, data } = validate(req.body ?? {});
  if (error) {
    return res.status(400).json({ error });
  }

  const created = await store.add(data);
  res.status(201).json(publicItem(created));
}

export async function getItem(req, res) {
  const item = await store.getById(req.params.id);
  if (!item || item.hidden) {
    return res.status(404).json({ error: "Item not found" });
  }
  res.json(publicItem(item));
}