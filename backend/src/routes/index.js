import express from "express";
import itemsRouter from "./items.js";
import adminRouter from "./admin.js";
import { readyHandler } from "./ready.js";

// All API routes in one place. app.js only imports this file.
// To add a new group of routes, import it here and add one router.use line.
const router = express.Router();

router.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// /health only says the app is running. /ready also checks the database,
// so the Load Balancer and the CD smoke test know the app can serve users.
router.get("/ready", readyHandler());

router.use("/items", itemsRouter);
router.use("/admin", adminRouter);

export default router;
