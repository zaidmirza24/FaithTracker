import Attendance from "../models/Attendance.js";
import Batch from "../models/Batch.js";
import Student from "../models/Student.js";
import mongoose from "mongoose";


/**
 * Fetch attendance with optional filters.
 * Always returns:
 *  - studentId: string  (stable even if Student doc is deleted)
 *  - studentName: snapshot string if present on Attendance (optional)
 *  - student: { _id, name, email } | null
 *  - batch: { _id, name, teacher, city } | null
 *
 * filters: { city, teacherId, batchId, studentId, startDate, endDate }
 */
export const getFilteredAttendance = async (filters) => {
  const { city, teacherId, batchId, studentId, startDate, endDate } = filters;
  let batchIds = [];

  // 1) Pre-filter batches by city/teacher if requested
  if (city || teacherId) {
    const batchFilter = {};
    if (city) batchFilter.city = city;
    if (teacherId) batchFilter.teacher = teacherId;

    const batches = await Batch.find(batchFilter).select("_id").lean();
    batchIds = batches.map((b) => b._id);
    if (batchIds.length === 0) return [];
  }

  // 2) Build attendance query
  const query = {};

  if (batchId && batchIds.length > 0) {
    const match = batchIds.some((id) => id.toString() === batchId.toString());
    if (!match) return [];
    query.batch = batchId;
  } else if (batchId) {
    query.batch = batchId;
  } else if (batchIds.length > 0) {
    query.batch = { $in: batchIds };
  }

  if (studentId) query.student = studentId;

  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = new Date(startDate);
    if (endDate) query.date.$lte = new Date(endDate);
  }

  // 3) First get lean attendance (keeps raw ObjectId even if ref deleted)
  const raw = await Attendance.find(query)
    .select({
      student: 1,
      batch: 1,
      date: 1,
      status: 1,
      remarks: 1,
      studentName: 1, // optional snapshot field on Attendance
    })
    .lean();

  if (raw.length === 0) return [];

  // 4) Collect existing refs to populate
  const studentIds = [
    ...new Set(raw.map((r) => (r.student ? r.student.toString() : null)).filter(Boolean)),
  ];
  const batchIdSet = [
    ...new Set(raw.map((r) => (r.batch ? r.batch.toString() : null)).filter(Boolean)),
  ];

  const [students, batches] = await Promise.all([
    studentIds.length
      ? Student.find({ _id: { $in: studentIds } }).select("_id name email").lean()
      : [],
    batchIdSet.length
      ? Batch.find({ _id: { $in: batchIdSet } }).select("_id name teacher city").lean()
      : [],
  ]);

  const studentMap = new Map(students.map((s) => [s._id.toString(), s]));
  const batchMap = new Map(batches.map((b) => [b._id.toString(), b]));

  // 5) Assemble final records with stable ids + optional populated docs
  const records = raw.map((r) => {
    const sid = r.student ? r.student.toString() : null;
    const bid = r.batch ? r.batch.toString() : null;
    return {
      _id: r._id,
      date: r.date,
      status: r.status,
      remarks: r.remarks,
      studentId: sid,                 // <= stable key for exporter
      studentName: r.studentName || "", // <= snapshot if saved during marking
      student: sid ? studentMap.get(sid) || null : null,
      batch: bid ? batchMap.get(bid) || null : null,
    };
  });

  return records;
};


/**
 * Aggregate attendance counts per batch/teacher/city
 * @param {Array} records - Attendance docs (from getFilteredAttendance)
 */
export const getAttendanceSummary = (records) => {
  const summary = {};

  records.forEach((r) => {
    if (!r.batch) return; // skip if batch missing
    const key = r.batch._id.toString(); // Can change to teacher/city
    if (!summary[key]) {
      summary[key] = {
        Present: 0,
        Absent: 0,
        Late: 0,
        Excused: 0,
        batch: r.batch.name,
      };
    }
    if (summary[key][r.status] === undefined) {
      // In case of unexpected status strings
      summary[key][r.status] = 0;
    }
    summary[key][r.status] += 1;
  });

  return Object.values(summary);
};
