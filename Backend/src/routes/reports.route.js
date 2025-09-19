import express from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { attendanceSummary, exportAttendanceExcel, exportSyllabus } from "../controllers/reports.controller.js";

import { syllabusSummary, exportSyllabusExcel } from "../controllers/reports.controller.js";

const router = express.Router();


router.get("/syllabus/summary", syllabusSummary);
router.get("/syllabus/export", exportSyllabusExcel);



router.use(requireAuth);
router.use(requireRole("admin", "teacher")); // Both roles can view

router.get("/summary", attendanceSummary);
router.get("/export", exportAttendanceExcel);


// Syllabus summary (teacher+admin)
router.get("/syllabus/summary", syllabusSummary);

// Export endpoints - admin only
// router.get("/export", exportAttendanceExcel); // existing
// make export syllabus admin-only:
router.get("/syllabus/export", exportSyllabusExcel);
router.get("/syllabus/export", exportSyllabus);


export default router;
