import express from "express";
import { deleteItem, listReported, restoreItem } from "../controllers/moderationController.js";
import { adminOnly } from "../middleware/adminOnly.js";

// Admin pages. Each one is protected with adminOnly, which checks the
// admin password before the page runs.
const router = express.Router();

router.get("/reports", adminOnly, listReported);
router.post("/items/:id/restore", adminOnly, restoreItem);
router.delete("/items/:id", adminOnly, deleteItem);

export default router;
