// Owner: Bonae
// POST   /api/items/:id/report          Report a suspicious listing (anyone)
// GET    /api/admin/reports             Reported listings (admin)
// POST   /api/admin/items/:id/restore   Show a hidden listing again (admin)
// DELETE /api/admin/items/:id           Delete a listing (admin)

import * as store from "../store/itemStore.js";
import { publicItem } from "../utils/publicItem.js";

export const REPORT_REASONS = ["spam", "fake", "wrong-info"];

// A listing reported by this many different people is hidden until an
// admin checks it
export const HIDE_AFTER = 3;

export async function reportItem(req, res) {
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim().toLowerCase() : "";
  const reporterId = typeof req.body?.reporterId === "string" ? req.body.reporterId.trim() : "";

  if (!REPORT_REASONS.includes(reason)) {
    return res.status(400).json({ error: `Reason must be one of: ${REPORT_REASONS.join(", ")}` });
  }
  // A random ID the website keeps in the browser, so one person can only
  // report a listing once
  if (reporterId.length < 8 || reporterId.length > 100) {
    return res.status(400).json({ error: "reporterId is required" });
  }

  const existing = await store.getById(req.params.id);
  if (!existing || existing.hidden) {
    return res.status(404).json({ error: "Item not found" });
  }

  const result = await store.addReport(existing.id, { reporterId, reason, date: new Date().toISOString() });
  if (!result) {
    return res.status(404).json({ error: "Item not found" });
  }
  if (!result.added) {
    return res.status(409).json({ error: "You have already reported this listing" });
  }

  const hidden = result.item.reports.length >= HIDE_AFTER;
  if (hidden) await store.update(existing.id, { hidden: true });

  res.status(201).json({ message: "Thanks, the listing has been reported.", hidden });
}

// What an admin sees: the item plus how many times each reason was given.
// The reporters' IDs are not shown.
function reportedItem(item) {
  const reasons = {};
  for (const r of item.reports) reasons[r.reason] = (reasons[r.reason] || 0) + 1;
  return {
    ...publicItem(item),
    hidden: Boolean(item.hidden),
    reportCount: item.reports.length,
    reasons,
    lastReportedAt: item.reports.at(-1).date,
  };
}

export async function listReported(req, res) {
  const reported = (await store.getAll())
    .filter((item) => item.reports?.length)
    .sort((a, b) => b.reports.length - a.reports.length);
  res.json(reported.map(reportedItem));
}

export async function restoreItem(req, res) {
  const item = await store.getById(req.params.id);
  if (!item) {
    return res.status(404).json({ error: "Item not found" });
  }
  const updated = await store.update(item.id, { hidden: false, reports: [] });
  res.json(publicItem(updated));
}

export async function deleteItem(req, res) {
  const removed = await store.remove(req.params.id);
  if (!removed) {
    return res.status(404).json({ error: "Item not found" });
  }
  res.status(204).end();
}
