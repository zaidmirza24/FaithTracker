import Attendance from "../models/Attendance.js";
import Batch from "../models/Batch.js";
import mongoose from "mongoose";

/**
 * Fetch attendance with optional filters
 * @param {Object} filters - { city, teacherId, batchId, studentId, startDate, endDate }
 */
export const getFilteredAttendance = async (filters) => {
  const { city, teacherId, batchId, studentId, startDate, endDate } = filters;
  let batchIds = [];

  // If city or teacher filter, get matching batches
  if (city || teacherId) {
    const batchFilter = {};
    if (city) batchFilter.city = city;
    if (teacherId) batchFilter.teacher = teacherId;

    const batches = await Batch.find(batchFilter).select("_id");
    batchIds = batches.map(b => b._id);

    // If no batches match the city/teacher filter, return empty array
    if (batchIds.length === 0) return [];
  }

  const query = {};

  // Combine batch filters
  if (batchId && batchIds.length > 0) {
    // Intersection of batchId param and filtered batchIds
    if (batchIds.includes(batchId)) query.batch = batchId;
    else return []; // No matching batch for combined filter
  } else if (batchId) {
    query.batch = batchId;
  } else if (batchIds.length > 0) {
    query.batch = { $in: batchIds };
  }

  if (studentId) query.student = studentId;

  // Date filter
  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = new Date(startDate);
    if (endDate) query.date.$lte = new Date(endDate);
  }

  const records = await Attendance.find(query)
    .populate("student", "name email")
    .populate("batch", "name teacher city");

  return records;
};

/**
 * Aggregate attendance counts per batch/teacher/city
 * @param {Array} records - Attendance docs
 */
export const getAttendanceSummary = (records) => {
  const summary = {};

  records.forEach(r => {
    const key = r.batch._id.toString(); // Can change to teacher/city
    if (!summary[key]) summary[key] = { Present: 0, Absent: 0, Late: 0, Excused: 0, batch: r.batch.name };
    summary[key][r.status] += 1;
  });

  return Object.values(summary);
};
