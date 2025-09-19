import Batch from "../models/Batch.js";
import Student from "../models/Student.js";
import Attendance from "../models/Attendance.js";
import mongoose from "mongoose";

// Valid attendance statuses
const VALID_STATUSES = ["Present", "Absent", "Holiday"]; // ✅ include Holiday

// Create a new batch
// add at top of file (if not already)
import { SUBJECT_MAP } from "../config/batchTypeMap.js"; // create this file if not present

// Create a new batch — automatically allocate subjects by batchType if mapping exists
export const createBatch = async (req, res) => {
  try {
    const { name, batchType } = req.body;
    const teacherId = req.user?.userId;
    const city = req.user?.city;

    if (!teacherId) {
      return res.status(400).json({ message: "Invalid token: teacherId missing" });
    }

    if (!name || name.trim() === "") {
      return res.status(400).json({ message: "Batch name is required" });
    }

    const batchData = {
      name: name.trim(),
      teacher: teacherId,
      city: city || "",
      batchType: batchType || null,
    };

    // Apply mapping if present
    if (batchType && SUBJECT_MAP && SUBJECT_MAP[batchType]) {
      // deep clone to avoid shared refs
      batchData.subjects = JSON.parse(JSON.stringify(SUBJECT_MAP[batchType]));
    } else {
      batchData.subjects = []; // or leave undefined if you prefer
    }

    const batch = await Batch.create(batchData);
    return res.status(201).json(batch);
  } catch (err) {
    console.error("createBatch error:", err);
    return res.status(500).json({ message: "Failed to create batch", error: err.message });
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
    const { batchId, records, date, isHoliday = false, holidayReason = "" } = req.body;

    if (!batchId || !mongoose.Types.ObjectId.isValid(batchId)) {
      return res.status(400).json({ message: "Invalid or missing batchId" });
    }
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ message: "records must be a non-empty array" });
    }

    const attendanceDate = date ? new Date(date) : new Date();
    if (isNaN(attendanceDate.getTime())) {
      return res.status(400).json({ message: "Invalid date format" });
    }
    attendanceDate.setHours(0, 0, 0, 0);

    const results = await Promise.all(
      records.map(async (r) => {
        try {
          if (!r?.studentId || !mongoose.Types.ObjectId.isValid(r.studentId)) {
            throw new Error(`Invalid studentId: ${r?.studentId}`);
          }

          // 👉 force "Holiday" if isHoliday is true
          const desiredStatus = isHoliday ? "Holiday" : r?.status;
          if (!desiredStatus) throw new Error(`Missing status for student ${r.studentId}`);

          const normalizedStatus =
            desiredStatus.charAt(0).toUpperCase() + desiredStatus.slice(1).toLowerCase();

          if (!VALID_STATUSES.includes(normalizedStatus)) {
            throw new Error(
              `Invalid status '${desiredStatus}' for student ${r.studentId}. Valid: ${VALID_STATUSES.join(", ")}`
            );
          }

          const effectiveRemarks = isHoliday
            ? holidayReason || "Holiday"
            : (r.remarks || "");

          let studentName = "";
          try {
            const stu = await Student.findById(r.studentId).select("name").lean();
            if (stu?.name) studentName = stu.name;
          } catch (_) {}

          const updated = await Attendance.findOneAndUpdate(
            { student: r.studentId, batch: batchId, date: attendanceDate },
            {
              $set: {
                status: normalizedStatus,
                remarks: effectiveRemarks,
                studentName,
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
      return res.status(207).json({
        message: "Some records failed",
        okCount: results.length - failures.length,
        failCount: failures.length,
        failures,
        records: results.filter((r) => r.ok).map((r) => r.record),
      });
    }

    return res.status(201).json(results.map((r) => r.record));
  } catch (err) {
    console.error("Mark attendance error:", err);
    return res.status(500).json({ message: "Failed to mark attendance", error: err?.message || "Unknown error" });
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
    const { period, year, month } = req.query; // add: period=3m|6m

    if (!mongoose.Types.ObjectId.isValid(batchId)) {
      return res.status(400).json({ message: "Invalid batch ID" });
    }

    const query = { batch: batchId };

    // ---- IST month boundaries (UTC+05:30) ----
    const TZ_OFFSET_MIN = 330; // Asia/Kolkata
    const TZ_OFFSET_MS  = TZ_OFFSET_MIN * 60 * 1000;

    // helpers: first day of month in IST expressed as a JS Date
    const istMonthStart = (y, m0) => {
      // 00:00 IST of given y,m => in UTC is (y,m,1 00:00) - 5:30
      const startUTCms = Date.UTC(y, m0, 1, 0, 0, 0, 0);
      return new Date(startUTCms - TZ_OFFSET_MS);
    };
    const istNextMonthStart = (y, m0) => istMonthStart(y, m0 + 1);

    // parse inputs
    const yNum = year && /^\d{4}$/.test(String(year)) ? Number(year) : null;
    const mNum = month != null && month !== "" && !Number.isNaN(Number(month))
      ? Number(month)
      : null;

    let start, end;

    // ---- Priority 1: period=3m|6m (full calendar months, ending at next month start) ----
    if (period === "3m" || period === "6m") {
      const months = period === "3m" ? 3 : 6;

      // Get "now" in IST to decide the current calendar month
      const nowUTC = new Date();
      const nowIST = new Date(nowUTC.getTime() + TZ_OFFSET_MS);
      const yNow = nowIST.getUTCFullYear();
      const mNow = nowIST.getUTCMonth(); // 0..11 (IST month via UTC getters on shifted date)

      // end = first day of next month (exclusive)
      end = istNextMonthStart(yNow, mNow);

      // start = first day of (currentMonth - (months - 1))
      // anchor at first of current month in IST, then move back N-1 months
      let aY = yNow, aM = mNow - (months - 1);
      // normalize year/month
      while (aM < 0) { aM += 12; aY -= 1; }
      start = istMonthStart(aY, aM);

    // ---- Priority 2: year + month ----
    } else if (yNum && mNum && mNum >= 1 && mNum <= 12) {
      start = istMonthStart(yNum, mNum - 1);
      end   = istNextMonthStart(yNum, mNum - 1);

    // ---- Priority 3: year only ----
    } else if (yNum) {
      start = istMonthStart(yNum, 0);        // Jan 1 (IST)
      end   = istMonthStart(yNum + 1, 0);    // Jan 1 next year (IST)

    // ---- Priority 4: month only (assume current IST year) ----
    } else if (mNum && mNum >= 1 && mNum <= 12) {
      const nowUTC = new Date();
      const nowIST = new Date(nowUTC.getTime() + TZ_OFFSET_MS);
      const yNow = nowIST.getUTCFullYear();
      start = istMonthStart(yNow, mNum - 1);
      end   = istNextMonthStart(yNow, mNum - 1);
    }

    if (start && end) {
      query.date = { $gte: start, $lt: end };
    }

    const records = await Attendance.find(query)
      .populate("student", "name")
      .sort({ date: -1 }) // keep your existing sort
      .lean();

    if (!records || records.length === 0) {
      return res.status(404).json({ message: "No attendance records found for this batch" });
    }

    res.json(records);
  } catch (err) {
    console.error("Get attendance history error:", err);
    res.status(500).json({ message: "Failed to fetch attendance history", error: err.message });
  }
};


// In batchController.js
// export const getSyllabusHistory = async (req, res) => {
//   const { batchId } = req.params;
//   try {
//     const batch = await Batch.findById(batchId).populate("syllabusHistory.updatedBy", "name");
//     if (!batch) return res.status(404).json({ message: "Batch not found" });

//     res.json(batch.syllabusHistory); // array of history objects
//   } catch (err) {
//     res.status(500).json({ message: "Server error" });
//   }
// };

