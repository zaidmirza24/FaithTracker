import bcrypt from "bcrypt";
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
export const getAttendance = async (req, res) => {
  try {
    const { batchId, year, month } = req.query;

    if (!batchId) return res.status(400).json({ message: "batchId is required" });

    let filter = { batch: batchId };

    if (year) {
      const y = parseInt(year);
      let startDate = new Date(y, 0, 1);
      let endDate = new Date(y + 1, 0, 1);

      if (month) {
        const m = parseInt(month) - 1;
        startDate = new Date(y, m, 1);
        endDate = new Date(y, m + 1, 1);
      }

      filter.date = { $gte: startDate, $lt: endDate };
    }

    // const records = await Attendance.find(filter).populate("student");
    const records = await Attendance.find(filter)
      .populate("student", "name")   // only bring student name + email
      .populate("batch", "name");     
    res.json(records);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch attendance", error: err.message });
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
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const teacher = await Teacher.create({
      name,
      email,
      passwordHash,
      city,
    });

    res.status(201).json({ message: "Teacher created successfully ✅", teacher });
  } catch (err) {
    console.error("Create teacher error:", err);
    res.status(500).json({ message: "Failed to create teacher", error: err.message });
  }
};
