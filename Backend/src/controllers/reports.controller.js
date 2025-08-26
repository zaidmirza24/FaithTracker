// src/controllers/reports.controller.js
import { getFilteredAttendance, getAttendanceSummary } from "../services/attendanceService.js";
import ExcelJS from "exceljs";

export const attendanceSummary = async (req, res) => {
  try {
    const filters = req.query;
    const records = await getFilteredAttendance(filters);

    if (!records.length) return res.json({ message: "No attendance records found" });

    const summary = getAttendanceSummary(records);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch attendance summary", error: err.message });
  }
};

// Requires ExcelJS and your getFilteredAttendance
// import ExcelJS from "exceljs";
const TZ_OFFSET_MS = 5.5 * 60 * 60 * 1000; // IST

// --- small utils ---
const localDateKey = (dt) => {
  const d = new Date(dt);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

// Prefer true id (studentId / ObjectId); fall back to synthesized stable key
const studentIdKey = (r) => {
  // If you adopted my getFilteredAttendance upgrade, these exist:
  if (r?.studentId) return String(r.studentId);

  // If not upgraded, try to salvage from populated/unpopulated forms:
  if (r?.student && typeof r.student === "object" && r.student?._id) return String(r.student._id);
  if (r?.student && (typeof r.student === "string" || r.student?.toString)) return String(r.student);

  // Last resort: synthesize a stable key so all records for the same deleted student stay together.
  // Use snapshot name if present; include a suffix based on first 6 chars of record _id to reduce collisions.
  const snap =
    r?.studentName ||
    r?.student_name ||
    r?.studentNameSnapshot ||
    r?.student_name_snapshot ||
    "unknown";
  const suffix = String(r?._id || "").slice(-6) || Math.random().toString(36).slice(2, 8);
  return `deleted:${snap}:${suffix}`;
};

const studentDisplayName = (r) => {
  // live populated name
  if (r?.student?.name) return r.student.name;
  // snapshot name ⇒ show with (deleted)
  if (r?.studentName) return `${r.studentName} (deleted)`;
  if (r?.student_name) return `${r.student_name} (deleted)`;
  // have an id but no name
  if (r?.student) return "Unknown (deleted)";
  return "Unknown (deleted)";
};


export const exportAttendanceExcel = async (req, res) => {
  try {
    const { year, month, period } = req.query;

    // 1) Fetch records (must include studentId/studentName via service above)
    let records = await getFilteredAttendance(req.query);

    // 2) Compute IST-aware range
    let start = null, end = null;
    const now = new Date();
    const yNow = now.getFullYear();
    const mNow = now.getMonth();

    if (period === "3m" || period === "6m") {
      const months = period === "3m" ? 3 : 6;
      const endUTC = Date.UTC(yNow, mNow + 1, 1, 0, 0, 0, 0);
      end = new Date(endUTC - TZ_OFFSET_MS);
      const anchor = new Date(Date.UTC(yNow, mNow, 1, 0, 0, 0, 0));
      anchor.setMonth(anchor.getMonth() - (months - 1));
      start = new Date(anchor.getTime() - TZ_OFFSET_MS);
    } else if (year && month) {
      const y = Number(year), m = Number(month) - 1;
      start = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0) - TZ_OFFSET_MS);
      end   = new Date(Date.UTC(y, m + 1, 1, 0, 0, 0, 0) - TZ_OFFSET_MS);
    } else if (year) {
      const y = Number(year);
      start = new Date(Date.UTC(y, 0, 1, 0, 0, 0, 0) - TZ_OFFSET_MS);
      end   = new Date(Date.UTC(y + 1, 0, 1, 0, 0, 0, 0) - TZ_OFFSET_MS);
    } else if (month) {
      const m = Number(month) - 1;
      start = new Date(Date.UTC(yNow, m, 1, 0, 0, 0, 0) - TZ_OFFSET_MS);
      end   = new Date(Date.UTC(yNow, m + 1, 1, 0, 0, 0, 0) - TZ_OFFSET_MS);
    }

    if (start && end) {
      const startMs = +start, endMs = +end;
      records = records.filter((r) => {
        const t = new Date(r.date).getTime();
        return t >= startMs && t < endMs;
      });
    }

    // 3) KEEP deleted students: only require batch to exist
    const before = records.length;
    const filteredRecords = records.filter((r) => r?.batch);
    const removed = before - filteredRecords.length;
    if (!filteredRecords.length) {
      return res.status(404).json({ message: "No records to export" });
    }
    if (removed > 0) {
      console.warn(`exportAttendanceExcel: skipped ${removed} records missing batch`);
    }

    // 4) Prepare workbook/sheet
    const workbook = new ExcelJS.Workbook();

    let batchName = "Attendance";
    const first = filteredRecords[0];
    if (first?.batch?.name) batchName = first.batch.name;
    else if (first?.batchName) batchName = first.batchName;
    else if (first?.batch_name) batchName = first.batch_name;
    else if (first?.class?.name) batchName = first.class.name;
    else if (first?.className) batchName = first.className;
    batchName = (batchName || "Attendance").trim().replace(/\s+/g, "_");

    const sheet = workbook.addWorksheet(batchName);

    // 5) Unique dates (YYYY-MM-DD)
    const dates = [...new Set(filteredRecords.map((r) => localDateKey(r.date)))].sort();

    // 6) Unique students (id -> name)
    const studentMap = new Map();
    for (const r of filteredRecords) {
      const sid = studentIdKey(r);
      if (!sid) continue; // only skip if Attendance.student is genuinely missing
      if (!studentMap.has(sid)) {
        studentMap.set(sid, studentDisplayName(r));
      }
    }

    // Sort: active first, then deleted, by name
    const students = [...studentMap.entries()].sort((a, b) => {
      const aDel = /\(deleted\)$/.test(a[1]);
      const bDel = /\(deleted\)$/.test(b[1]);
      if (aDel !== bDel) return aDel - bDel;
      return a[1].localeCompare(b[1]);
    });

    // 7) Month header groups (for merged top row)
    const monthGroups = [];
    let startIdx = 0;
    while (startIdx < dates.length) {
      const d0 = new Date(dates[startIdx]);
      const y = d0.getFullYear();
      const m = d0.getMonth();
      let endIdx = startIdx;
      while (
        endIdx + 1 < dates.length &&
        new Date(dates[endIdx + 1]).getFullYear() === y &&
        new Date(dates[endIdx + 1]).getMonth() === m
      ) {
        endIdx++;
      }
      const label = d0.toLocaleString("en-US", { month: "long", year: "numeric" });
      monthGroups.push({ label, start: startIdx, end: endIdx });
      startIdx = endIdx + 1;
    }

    // 8) Headers
    sheet.addRow(["Student Name", ...dates.map(() => "")]); // row 1
    const headerRow = sheet.addRow(["Student Name", ...dates]); // row 2
    headerRow.font = { bold: true };

    // Merge "Student Name"
    sheet.mergeCells(1, 1, 2, 1);
    const nameHeaderCell = sheet.getCell(1, 1);
    nameHeaderCell.value = "Student Name";
    nameHeaderCell.alignment = { vertical: "middle", horizontal: "center" };

    // Merge month blocks
    monthGroups.forEach(({ label, start, end }) => {
      const startCol = 2 + start;
      const endCol = 2 + end;
      sheet.mergeCells(1, startCol, 1, endCol);
      const cell = sheet.getCell(1, startCol);
      cell.value = label;
      cell.font = { bold: true };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
      cell.border = { top: { style: "thin" }, bottom: { style: "thin" } };
    });

    // 9) Data rows  ——— ONLY CHANGE IS THE ELSE → "Not in Batch"
    for (const [sidKey, name] of students) {
      const row = [name];
      for (const dateKey of dates) {
        const rec = filteredRecords.find(
          (r) => studentIdKey(r) === sidKey && localDateKey(r.date) === dateKey
        );
        const cellText = rec
          ? `${rec.status ?? ""}${rec.remarks ? ` (${rec.remarks})` : ""}`
          : "Not in Batch"; // ← was "", now explicit placeholder
        row.push(cellText);
      }
      sheet.addRow(row);
    }

    // 10) Layout & styling
    sheet.columns = Array(headerRow.cellCount).fill({ width: 20 });

    sheet.eachRow((row, rowNumber) => {
      row.alignment = { vertical: "middle", horizontal: "center" };
      if (rowNumber >= 3) {
        row.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: rowNumber % 2 === 0 ? "FFEFEFEF" : "FFFFFFFF" },
        };
      }
    });

    monthGroups.forEach(({ start }) => {
      const startCol = 2 + start;
      for (let r = 1; r <= sheet.rowCount; r++) {
        const cell = sheet.getRow(r).getCell(startCol);
        cell.border = { ...cell.border, left: { style: "thick" } };
      }
    });

    // Status highlighting
    const firstDataRow = 3;
    const lastCol = 1 + dates.length;
    for (let r = firstDataRow; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      for (let c = 2; c <= lastCol; c++) {
        const cell = row.getCell(c);
        const text = String(cell.value ?? "");
        if (text.startsWith("Present")) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD1FAE5" } };
        } else if (text.startsWith("Absent")) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } };
        }
      }
    }

    // 11) Filename
    const startDate = new Date(dates[0]);
    const endDate = new Date(dates[dates.length - 1]);
    let fileName;
    if (
      startDate.getMonth() === endDate.getMonth() &&
      startDate.getFullYear() === endDate.getFullYear()
    ) {
      const monthName = startDate.toLocaleString("en-US", { month: "long" });
      fileName = `${batchName}_${monthName}_${startDate.getFullYear()}.xlsx`;
    } else {
      const sM = startDate.toLocaleString("en-US", { month: "short" });
      const eM = endDate.toLocaleString("en-US", { month: "short" });
      const sY = startDate.getFullYear();
      const eY = endDate.getFullYear();
      fileName = sY === eY
        ? `${batchName}_${sM}_to_${eM}_${sY}.xlsx`
        : `${batchName}_${sM}${sY}_to_${eM}${eY}.xlsx`;
    }

    // 12) Send
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("exportAttendanceExcel error:", err);
    res.status(500).json({ message: "Failed to export Excel", error: err.message });
  }
};

