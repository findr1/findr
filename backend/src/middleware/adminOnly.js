import { createHash, timingSafeEqual } from "node:crypto";

// Lets a request through only if it carries the admin password:
//   Authorization: Bearer <ADMIN_TOKEN>
// ADMIN_TOKEN is a secret set on the server, never in git. Without it the
// admin pages are switched off.
export function adminOnly(req, res, next) {
  const token = process.env.ADMIN_TOKEN;
  if (!token) {
    return res.status(503).json({ error: "Admin pages are switched off" });
  }

  const header = req.get("authorization") || "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : "";

  // Compare hashes in constant time, so the time taken doesn't give away
  // how much of the password was right
  const hash = (text) => createHash("sha256").update(text).digest();
  if (!given || !timingSafeEqual(hash(given), hash(token))) {
    return res.status(401).json({ error: "Admin password required" });
  }
  next();
}
