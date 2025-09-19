import express from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  createBatch,
  listBatches,
  addStudents,
  listStudents,
  markAttendance,
  deleteBatch,
  updateStudent,
  deleteStudent,
  getTodayAttendance,
  getAttendanceHistory,
  
} from "../controllers/teacher.controller.js";

import { createOrUpdateSyllabus, getSyllabusByDate } from "../controllers/syllabus.controller.js";



const router = express.Router();

// Middleware
router.use(requireAuth);
router.use(requireRole("teacher"));

// Routes
router.post("/batches", createBatch);
router.get("/batches", listBatches);
router.post("/batches/:id/students", addStudents);
router.get("/batches/:id/students", listStudents);
router.post("/attendance", markAttendance);
router.delete("/batches/:id", deleteBatch);

// GET today's attendance
router.get("/attendance/today/:batchId", getTodayAttendance);

// GET /api/teacher/attendance/history/:batchId
router.get("/attendance/history/:batchId", getAttendanceHistory);


// Update a student
router.put("/students/:studentId",updateStudent);

// Delete a student
router.delete("/students/:studentId", deleteStudent);

// Manage syllabus for a batch (teacher)
router.post("/batches/:batchId/syllabus", createOrUpdateSyllabus);
router.get("/batches/:batchId/syllabus", getSyllabusByDate);
// In routes/teacher.js
// router.get("/batches/:batchId/syllabus/history", getSyllabusHistory);




export default router;



