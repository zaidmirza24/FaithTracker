// import bcrypt from "bcrypt";
import Teacher from "../models/Teachers.js";
import Batch from "../models/Batch.js";
import Attendance from "../models/Attendance.js";

// Get list of all cities (from teachers)
export const getCities = async (req, res) => {
  try {
    const cities = await Teacher.distinct("city");
    if (cities.length === 0) {
      return res.status(404).json({ message: "No cities found" });
    }
    res.json(cities);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch cities", error: err.message });
  }
};

// Get teachers in a specific city
export const getTeachersByCity = async (req, res) => {
  try {
    const { city } = req.params;
    const teachers = await Teacher.find({ city }).select("name email city");
    

    if (teachers.length === 0) {
      return res.status(404).json({ message: `No teachers found in ${city}` });
    }

    res.json(teachers);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch teachers", error: err.message });
  }
};


export const getBatchesByTeacher = async (req, res) => {
  try {
    const { id: teacherId } = req.params;
    const batches = await Batch.find({ teacher: teacherId });

    if (batches.length === 0) {
      return res.status(404).json({ message: "No batches found for this teacher" });
    }

    res.json(batches);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch batches", error: err.message });
  }
};


// Get attendance with optional filters: city, teacher, batch, date
// admin.controller.js
// GET /admin/attendance?batchId=...&period=3m|6m&year=YYYY&month=1-12
export const getAttendance = async (req, res) => {
  try {
    const { batchId, period, year, month } = req.query;
    if (!batchId) {
      return res.status(400).json({ message: "batchId is required" });
    }

    const filter = { batch: batchId };

    // --- date range calculation ---
    let startDate = null;
    let endDate = null;

    // helper: first day of month at local midnight
    const firstOfMonth = (y, m0) => {
      const d = new Date(y, m0, 1);
      d.setHours(0, 0, 0, 0);
      return d;
    };

    // helper: first day of next month
    const firstOfNextMonth = (y, m0) => firstOfMonth(y, m0 + 1);

    if (period === "3m" || period === "6m") {
      const months = period === "3m" ? 3 : 6;

      const now = new Date();
      const y = now.getFullYear();
      const m0 = now.getMonth(); // 0-11

      // end = first of next month (exclusive)
      endDate = firstOfNextMonth(y, m0);

      // start = first of (currentMonth - (months - 1))
      const anchor = new Date(y, m0, 1); // first of current month
      anchor.setHours(0, 0, 0, 0);
      anchor.setMonth(anchor.getMonth() - (months - 1));
      startDate = new Date(anchor); // already at 00:00:00.000

    } else if (year && month) {
      const y = Number(year);
      const m0 = Number(month) - 1;
      startDate = firstOfMonth(y, m0);
      endDate = firstOfNextMonth(y, m0);
    } else if (year) {
      const y = Number(year);
      startDate = firstOfMonth(y, 0);      // Jan 1
      endDate = firstOfMonth(y + 1, 0);    // Jan 1 next year
    }
    // --------------------------------

    if (startDate && endDate) {
      filter.date = { $gte: startDate, $lt: endDate };
    }

    // Debug (temporary): check what range actually applied
    console.log("GET /admin/attendance", {
      batchId,
      period,
      year,
      month,
      startDate,
      endDate,
    });

    const records = await Attendance.find(filter)
      .populate("student", "name")
      .populate("batch", "name");

    return res.json(records);
  } catch (err) {
    console.error("getAttendance error:", err);
    return res
      .status(500)
      .json({ message: "Failed to fetch attendance", error: err.message });
  }
};


// ✅ Admin creates a new teacher
export const createTeacher = async (req, res) => {
  try {
    const { name, email, password, city } = req.body;

    if (!name || !email || !password || !city) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Check if teacher already exists
    const existing = await Teacher.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "Teacher already exists with this email" });
    }

    // Hash password
    // const salt = await bcrypt.genSalt(10);
    // const passwordHash = await bcrypt.hash(password, salt);

    const teacher = await Teacher.create({
      name,
      email,
      password,
      city,
    });

    res.status(201).json({ message: "Teacher created successfully ✅", teacher });
  } catch (err) {
    console.error("Create teacher error:", err);
    res.status(500).json({ message: "Failed to create teacher", error: err.message });
  }
};
