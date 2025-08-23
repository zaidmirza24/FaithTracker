import express from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  getCities,
  getTeachersByCity,
  getBatchesByTeacher,
  getAttendance,
  createTeacher
} from "../controllers/admin.controller.js";

const router = express.Router();

// Middleware
router.use(requireAuth);
router.use(requireRole("admin"));

// Routes
router.get("/cities", getCities);
router.get("/cities/:city/teachers", getTeachersByCity);
router.get("/teachers/:id/batches", getBatchesByTeacher);
router.get("/attendance", getAttendance);
router.post("/teachers",createTeacher);

export default router;
