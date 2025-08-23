import express from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { attendanceSummary, exportAttendanceExcel } from "../controllers/reports.controller.js";

const router = express.Router();

router.use(requireAuth);
router.use(requireRole("admin", "teacher")); // Both roles can view

router.get("/summary", attendanceSummary);
router.get("/export", exportAttendanceExcel);

export default router;
