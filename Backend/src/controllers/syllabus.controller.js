// Backend/src/controllers/syllabus.controller.js
import Syllabus from "../models/Syllabus.js";
import Batch from "../models/Batch.js";
import mongoose from "mongoose";


/**
 * Normalize a date string to a Date object at UTC midnight (so queries are consistent).
 * Accepts 'YYYY-MM-DD' or ISO date; returns Date object.
 */
const normalizeDate = (dateStr) => {
  if (!dateStr) return new Date(new Date().toISOString().slice(0, 10));
  // create date at midnight (local) then convert to same-date UTC start
  const d = new Date(dateStr);
  // normalize by zeroing time components
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

export const createOrUpdateSyllabus = async (req, res) => {
  try {
    const { batchId } = req.params;
    const { date, entries } = req.body;
    if (!batchId || !mongoose.Types.ObjectId.isValid(batchId)) {
      return res.status(400).json({ message: "Invalid batchId" });
    }
    if (!Array.isArray(entries)) {
      return res.status(400).json({ message: "Entries must be an array" });
    }
    const normalized = normalizeDate(date);

    // ensure batch exists
    const batch = await Batch.findById(batchId);
    if (!batch) return res.status(404).json({ message: "Batch not found" });

    // optional: validate that entry.subject exists in batch.subjects
    if (batch.subjects && batch.subjects.length) {
      const validSubjects = batch.subjects.map((s) => s.name);
      for (const e of entries) {
        if (!validSubjects.includes(e.subject)) {
          return res.status(400).json({ message: `Invalid subject: ${e.subject}` });
        }
        // optionally validate chapter is in batch.subjects' chapters
        const subj = batch.subjects.find((s) => s.name === e.subject);
        if (subj && subj.chapters && subj.chapters.length && !subj.chapters.includes(e.chapter)) {
          return res.status(400).json({ message: `Invalid chapter for ${e.subject}: ${e.chapter}` });
        }
      }
    }

    const payload = {
      batch: batchId,
      date: normalized,
      entries,
      createdBy: req.user?.userId || null,
      createdAt: new Date(),
    };

    const doc = await Syllabus.findOneAndUpdate(
      { batch: batchId, date: normalized },
      payload,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.json(doc);
  } catch (err) {
    console.error("createOrUpdateSyllabus error:", err);
    return res.status(500).json({ message: "Failed to save syllabus", error: err.message });
  }
};

// export const getSyllabusByDate = async (req, res) => {
//   try {
//     const { batchId } = req.params;
//     const date = req.query.date; // optional
//     if (!batchId || !mongoose.Types.ObjectId.isValid(batchId)) {
//       return res.status(400).json({ message: "Invalid batchId" });
//     }
//     const normalized = normalizeDate(date);
//     const syllabus = await Syllabus.findOne({ batch: batchId, date: normalized }).lean();
//     // Also return batch info (including embedded subjects) to populate dropdowns
//     const batch = await Batch.findById(batchId).lean();
//     return res.json({ batch, date: normalized.toISOString().slice(0, 10), syllabus: syllabus || null });
//   } catch (err) {
//     console.error("getSyllabusByDate error:", err);
//     return res.status(500).json({ message: "Failed to fetch syllabus", error: err.message });
//   }
// };




/**
 * GET /teacher/batches/:batchId/syllabus
 * Query params supported:
 * - startDate / endDate (YYYY-MM-DD)  (preferred)
 * - from / to / fromDate / toDate      (aliases)
 * - period (e.g. "3m", "6m")          -> converted to start/end
 * - date (single YYYY-MM-DD)          -> existing behavior (returns that day's syllabus)
 * - year / month                      -> fallback (month is 1-12)
 * - teacherId                         -> filter createdBy (scope)
 */
export const getSyllabusByDate = async (req, res) => {
  try {
    const { batchId } = req.params;
    if (!batchId || !mongoose.Types.ObjectId.isValid(batchId)) {
      return res.status(400).json({ message: "Invalid batchId" });
    }

    // Accept many names for date inputs (frontend might send different aliases)
    const {
      startDate: qStart,
      endDate: qEnd,
      from,
      to,
      fromDate,
      toDate,
      period,
      date: singleDate,
      year,
      month,
      teacherId,
    } = req.query;

    // Helper: convert YYYY-MM-DD -> Date (start-of-day UTC)
    const parseYMD = (s) => {
      if (!s) return null;
      // Accepts 'YYYY-MM-DD' — JS Date('YYYY-MM-DD') -> UTC midnight
      const d = new Date(String(s));
      if (Number.isNaN(d.getTime())) return null;
      return d;
    };

    // compute explicit start/end
    let start = parseYMD(qStart || from || fromDate || null);
    let end = parseYMD(qEnd || to || toDate || null);

    // if explicit single date was provided, treat as start=end=that date
    if (!start && singleDate) {
      const sd = parseYMD(singleDate);
      if (sd) {
        start = new Date(sd);
        end = new Date(sd);
      }
    }

    // If period token provided and no explicit start/end, compute range
    if ((!start && !end) && period) {
      const now = new Date();
      const endLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // today local date
      let startLocal = new Date(endLocal);
      if (period === "3m") startLocal.setMonth(startLocal.getMonth() - 3);
      else if (period === "6m") startLocal.setMonth(startLocal.getMonth() - 6);
      else {
        // unsupported period token — ignore
      }
      if (!start && startLocal) start = new Date(startLocal);
      if (!end) end = new Date(endLocal);
    }

    // If still no start/end and year/month provided, build month range
    if ((!start && !end) && year) {
      const yNum = Number(year);
      const mNum = month ? Number(month) : null;
      if (!Number.isNaN(yNum) && (!month || (mNum >= 1 && mNum <= 12))) {
        if (mNum) {
          // month specified: range = first day to last day of that month
          start = new Date(yNum, mNum - 1, 1);
          end = new Date(yNum, mNum, 0); // last day of month
        } else {
          // whole year
          start = new Date(yNum, 0, 1);
          end = new Date(yNum, 11, 31);
        }
      }
    }

    // If we have start but end missing -> make end = start
    if (start && !end) end = new Date(start);

    // Normalize end to end-of-day (23:59:59.999) to make <= comparisons inclusive
    if (end) {
      end = new Date(end);
      end.setHours(23, 59, 59, 999);
    }
    // Normalize start to start-of-day
    if (start) {
      start = new Date(start);
      start.setHours(0, 0, 0, 0);
    }

    // Build query
    const query = { batch: batchId };

    if (start && end) {
      query.date = { $gte: start, $lte: end };
    } else if (start && !end) {
      query.date = start;
    } else if (singleDate) {
      // fallback behavior (if single date passed earlier and parsed)
      const sd = parseYMD(singleDate);
      if (sd) {
        query.date = sd;
      }
    }
    // If teacherId passed, filter by createdBy
    if (teacherId && mongoose.Types.ObjectId.isValid(String(teacherId))) {
      query.createdBy = teacherId;
    }

    // Fetch batch info
    const batch = await Batch.findById(batchId).lean();
    if (!batch) return res.status(404).json({ message: "Batch not found" });

    // Query syllabi (could be multiple docs across dates)
    // Populate createdBy to return user names
    const syllabi = await Syllabus.find(query)
      .populate("createdBy", "name email")
      .sort({ date: -1 })
      .lean();

    // Prepare response dates in YYYY-MM-DD string form for frontend convenience
    const respStart = start ? start.toISOString().slice(0, 10) : null;
    const respEnd = end ? end.toISOString().slice(0, 10) : null;

    return res.json({
      batch,
      syllabi, // array (0..n) each contains { date, entries: [...], createdBy, createdAt, ... }
      startDate: respStart,
      endDate: respEnd,
      count: Array.isArray(syllabi) ? syllabi.length : 0,
    });
  } catch (err) {
    console.error("getSyllabusByDate error:", err);
    return res.status(500).json({ message: "Failed to fetch syllabus", error: err.message });
  }
};
