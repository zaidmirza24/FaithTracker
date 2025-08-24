import Batch from "../models/Batch.js";
import Student from "../models/Student.js";
import Attendance from "../models/Attendance.js";
import mongoose from "mongoose";

// Valid attendance statuses
const VALID_STATUSES = ["Present", "Absent", "Late", "Excused"];

// Create a new batch
export const createBatch = async (req, res) => {
  try {
    const { name } = req.body;
    const teacherId = req.user.userId;
    const city = req.user.city;

    if (!teacherId) {
      return res.status(400).json({ message: "Invalid token: teacherId missing" });
    }

    if (!name || name.trim() === "") {
      return res.status(400).json({ message: "Batch name is required" });
    }

    const batch = await Batch.create({ name, teacher: teacherId, city });
    res.status(201).json(batch);
  } catch (err) {
    res.status(500).json({ message: "Failed to create batch", error: err.message });
  }
};

// List teacher's batches
export const listBatches = async (req, res) => {
  try {
    const teacherId = req.user.userId;
    const batches = await Batch.find({ teacher: teacherId });

    if (batches.length === 0) {
      return res.status(404).json({ message: "No batches found for this teacher" });
    }

    res.json(batches);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch batches", error: err.message });
  }
};

// Add students to a batch
export const addStudents = async (req, res) => {
  try {
    const { id: batchId } = req.params;
    const { students } = req.body;

    if (!mongoose.Types.ObjectId.isValid(batchId)) {
      return res.status(400).json({ message: "Invalid batch ID" });
    }

    if (!students || !Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ message: "No students provided to add" });
    }

    const studentDocs = students.map(s => ({
      ...s,
      batch: new mongoose.Types.ObjectId(batchId)
    }));

    const added = await Student.insertMany(studentDocs);
    res.status(201).json(added);
  } catch (err) {
    res.status(500).json({ message: "Failed to add students", error: err.message });
  }
};

// List students in a batch
export const listStudents = async (req, res) => {
  try {
    const { id: batchId } = req.params;
    const students = await Student.find({ batch: batchId });

    res.json(students);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch students", error: err.message });
  }
};

// Delete a batch
export const deleteBatch = async (req, res) => {
  try {
    const { id: batchId } = req.params;

    // Validate batchId
    if (!mongoose.Types.ObjectId.isValid(batchId)) {
      return res.status(400).json({ message: "Invalid batch ID" });
    }

    // Check if batch exists
    const batch = await Batch.findById(batchId);
    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    // Delete all students in this batch
    await Student.deleteMany({ batch: batchId });

    // Delete all attendance records linked to this batch
    await Attendance.deleteMany({ batch: batchId });

    // Delete the batch itself
    await Batch.findByIdAndDelete(batchId);

    res.json({ message: "Batch and related data deleted successfully ✅" });
  } catch (err) {
    console.error("Delete batch error:", err);
    res.status(500).json({ message: "Failed to delete batch", error: err.message });
  }
};

// Mark attendance
// const VALID_STATUSES = ["Present", "Absent", "Late", "Excused"];
export const markAttendance = async (req, res) => {
  try {
    const { batchId, records, date } = req.body;

    // 1) Basic validation
    if (!batchId || !mongoose.Types.ObjectId.isValid(batchId)) {
      return res.status(400).json({ message: "Invalid or missing batchId" });
    }
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ message: "records must be a non-empty array" });
    }

    // 2) Normalize the date (default = today)
    const attendanceDate = date ? new Date(date) : new Date();
    if (isNaN(attendanceDate.getTime())) {
      return res.status(400).json({ message: "Invalid date format" });
    }
    attendanceDate.setHours(0, 0, 0, 0);

    // 3) Upsert each record, but collect successes/failures
    const results = await Promise.all(
      records.map(async (r) => {
        try {
          if (!r?.studentId || !mongoose.Types.ObjectId.isValid(r.studentId)) {
            throw new Error(`Invalid studentId: ${r?.studentId}`);
          }
          if (!r?.status) {
            throw new Error(`Missing status for student ${r.studentId}`);
          }

          const normalizedStatus =
            r.status.charAt(0).toUpperCase() + r.status.slice(1).toLowerCase();

          if (!VALID_STATUSES.includes(normalizedStatus)) {
            throw new Error(
              `Invalid status '${r.status}' for student ${r.studentId}. Valid: ${VALID_STATUSES.join(", ")}`
            );
          }

          // Explicit upsert: set fixed fields on insert, status each time
          const updated = await Attendance.findOneAndUpdate(
            { student: r.studentId, batch: batchId, date: attendanceDate },
            {
              $set: {
                status: normalizedStatus,
                remarks: r.remarks || "",
              },
              $setOnInsert: {
                student: r.studentId,
                batch: batchId,
                date: attendanceDate,
              },
            },
            {
              new: true,
              upsert: true,
              setDefaultsOnInsert: true,
              runValidators: true,
              context: "query",
            }
          ).lean();

          return { ok: true, record: updated };
        } catch (e) {
          return { ok: false, error: e.message, studentId: r?.studentId || null };
        }
      })
    );

    const failures = results.filter((r) => !r.ok);
    if (failures.length) {
      // Multi-status style response
      return res.status(207).json({
        message: `Some records failed`,
        okCount: results.length - failures.length,
        failCount: failures.length,
        failures,
        records: results.filter((r) => r.ok).map((r) => r.record),
      });
    }

    return res.status(201).json(results.map((r) => r.record));
  } catch (err) {
    console.error("Mark attendance error:", err);
    return res.status(500).json({
      message: "Failed to mark attendance",
      error: err?.message || "Unknown error",
    });
  }
};





// Update a student’s name
export const updateStudent = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { name } = req.body;

    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ message: "Invalid student ID" });
    }

    if (!name || name.trim() === "") {
      return res.status(400).json({ message: "Student name is required" });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    student.name = name;
    await student.save();

    res.json({ message: "Student updated successfully ✅", student });
  } catch (err) {
    res.status(500).json({ message: "Failed to update student", error: err.message });
  }
};

// Delete a student
export const deleteStudent = async (req, res) => {
  try {
    const { studentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ message: "Invalid student ID" });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    await Student.findByIdAndDelete(studentId);
    res.json({ message: "Student deleted successfully ✅" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete student", error: err.message });
  }
};


// Get today's attendance for a batch
export const getTodayAttendance = async (req, res) => {
  try {
    const { batchId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(batchId)) {
      return res.status(400).json({ message: "Invalid batch ID" });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0); // normalize to midnight

    // Fetch attendance for today
    const records = await Attendance.find({ batch: batchId, date: today }).populate("student");

    res.json(records); // send an array of attendance records
  } catch (err) {
    console.error("Get today attendance error:", err);
    res.status(500).json({ message: "Failed to fetch today's attendance", error: err.message });
  }
};

// Get attendance history for a batch
// Get attendance history for a batch (IST-aware month/year filtering)
export const getAttendanceHistory = async (req, res) => {
  try {
    const { batchId } = req.params;
    const { year, month } = req.query; // year=YYYY, month=1..12

    if (!mongoose.Types.ObjectId.isValid(batchId)) {
      return res.status(400).json({ message: "Invalid batch ID" });
    }

    const query = { batch: batchId };

    // ---- Build IST (UTC+05:30) boundaries so months match what users see ----
    const TZ_OFFSET_MIN = 330; // Asia/Kolkata
    const TZ_OFFSET_MS  = TZ_OFFSET_MIN * 60 * 1000;

    const yNum = year && /^\d{4}$/.test(String(year)) ? Number(year) : null;
    const mNum = month != null && month !== "" && !Number.isNaN(Number(month))
      ? Number(month)
      : null;

    let start, end;

    if (yNum && mNum && mNum >= 1 && mNum <= 12) {
      // [YYYY-MM-01 00:00 IST, YYYY-(MM+1)-01 00:00 IST)
      const startUTCms = Date.UTC(yNum, mNum - 1, 1, 0, 0, 0, 0);
      const endUTCms   = Date.UTC(yNum, mNum,     1, 0, 0, 0, 0);
      start = new Date(startUTCms - TZ_OFFSET_MS);
      end   = new Date(endUTCms   - TZ_OFFSET_MS);
    } else if (yNum) {
      // Whole year in IST
      const startUTCms = Date.UTC(yNum,     0, 1, 0, 0, 0, 0);
      const endUTCms   = Date.UTC(yNum + 1, 0, 1, 0, 0, 0, 0);
      start = new Date(startUTCms - TZ_OFFSET_MS);
      end   = new Date(endUTCms   - TZ_OFFSET_MS);
    } else if (mNum && mNum >= 1 && mNum <= 12) {
      // Month without year => assume current year (IST)
      const now = new Date();
      const nowYear = now.getUTCFullYear(); // ok since we convert to IST below
      const startUTCms = Date.UTC(nowYear, mNum - 1, 1, 0, 0, 0, 0);
      const endUTCms   = Date.UTC(nowYear, mNum,     1, 0, 0, 0, 0);
      start = new Date(startUTCms - TZ_OFFSET_MS);
      end   = new Date(endUTCms   - TZ_OFFSET_MS);
    }

    if (start && end) {
      query.date = { $gte: start, $lt: end };
    }

    const records = await Attendance.find(query)
      .populate("student", "name")
      .sort({ date: -1 });

    if (!records || records.length === 0) {
      return res.status(404).json({ message: "No attendance records found for this batch" });
    }

    res.json(records);
  } catch (err) {
    console.error("Get attendance history error:", err);
    res.status(500).json({ message: "Failed to fetch attendance history", error: err.message });
  }
};
