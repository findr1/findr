import express from "express";
import { createItem, getItem } from "../controllers/reportController.js";
import { listItems } from "../controllers/searchController.js";
import { claimItem, markReturned } from "../controllers/claimController.js";
import { reportItem } from "../controllers/moderationController.js";

const router = express.Router();

router.get("/", listItems);
router.post("/", createItem);
router.get("/:id", getItem);
router.post("/:id/claim", claimItem);
router.patch("/:id/returned", markReturned);
router.post("/:id/report", reportItem);

export default router;
