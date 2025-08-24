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

export const exportAttendanceExcel = async (req, res) => {
  try {
    const { batchId, period, year, month } = req.query;

    // --- 0) Validate
    if (!batchId || !mongoose.Types.ObjectId.isValid(batchId)) {
      return res.status(400).json({ message: "Valid batchId is required" });
    }

    // --- 1) Build IST month boundaries (UTC+05:30)
    const TZ_OFFSET_MS = 330 * 60 * 1000; // Asia/Kolkata

    const istMonthStart = (y, m0) => new Date(Date.UTC(y, m0, 1, 0, 0, 0, 0) - TZ_OFFSET_MS);
    const istNextMonthStart = (y, m0) => istMonthStart(y, m0 + 1);

    let start = null, end = null;

    const yNum = year && /^\d{4}$/.test(String(year)) ? Number(year) : null;
    const mNum = month != null && month !== "" && !Number.isNaN(Number(month)) ? Number(month) : null;

    if (period === "3m" || period === "6m") {
      const months = period === "3m" ? 3 : 6;
      const nowIST = new Date(Date.now() + TZ_OFFSET_MS);
      const yNow = nowIST.getUTCFullYear();
      const mNow = nowIST.getUTCMonth();
      end = istNextMonthStart(yNow, mNow); // exclusive
      let aY = yNow, aM = mNow - (months - 1);
      while (aM < 0) { aM += 12; aY -= 1; }
      start = istMonthStart(aY, aM);
    } else if (yNum && mNum && mNum >= 1 && mNum <= 12) {
      start = istMonthStart(yNum, mNum - 1);
      end   = istNextMonthStart(yNum, mNum - 1);
    } else if (yNum) {
      start = istMonthStart(yNum, 0);
      end   = istMonthStart(yNum + 1, 0);
    } else if (mNum && mNum >= 1 && mNum <= 12) {
      const nowIST = new Date(Date.now() + TZ_OFFSET_MS);
      const yNow = nowIST.getUTCFullYear();
      start = istMonthStart(yNow, mNum - 1);
      end   = istNextMonthStart(yNow, mNum - 1);
    }

    // --- 2) DB query with range (avoid post-filter mistakes)
    const query = { batch: batchId };
    if (start && end) query.date = { $gte: start, $lt: end };

    const records = await Attendance.find(query)
      .populate("student", "name")
      .populate("batch", "name")
      .sort({ date: 1 })
      .lean();

    if (!records.length) {
      return res.status(404).json({ message: "No records to export for the selected range" });
    }

    // --- 3) Build workbook (same as before)
    const workbook = new ExcelJS.Workbook();

    // Batch name
    let batchName = "Attendance";
    if (records[0].batch?.name) {
      batchName = records[0].batch.name.trim().replace(/\s+/g, "_");
    } else if (records[0].batchName) {
      batchName = records[0].batchName.trim().replace(/\s+/g, "_");
    } else if (records[0].batch_name) {
      batchName = records[0].batch_name.trim().replace(/\s+/g, "_");
    } else if (records[0].class?.name) {
      batchName = records[0].class.name.trim().replace(/\s+/g, "_");
    } else if (records[0].className) {
      batchName = records[0].className.trim().replace(/\s+/g, "_");
    }

    const sheet = workbook.addWorksheet(batchName);

    const localDateKey = (value) => {
      const d = new Date(value);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    const dates = [...new Set(records.map(r => localDateKey(r.date)))].sort();
    const students = [...new Map(records.map(r => [String(r.student?._id || r.student), r.student?.name || r.studentName || ""])).entries()];

    // Month groups for merged headers
    const monthGroups = [];
    for (let i = 0; i < dates.length;) {
      const d0 = new Date(dates[i]);
      const y = d0.getFullYear(), m = d0.getMonth();
      let j = i;
      while (j + 1 < dates.length) {
        const dNext = new Date(dates[j + 1]);
        if (dNext.getFullYear() !== y || dNext.getMonth() !== m) break;
        j++;
      }
      monthGroups.push({
        label: d0.toLocaleString("en-US", { month: "long", year: "numeric" }),
        start: i,
        end: j
      });
      i = j + 1;
    }

    // Headers
    sheet.addRow(["Student Name", ...dates.map(() => "")]); // row 1 (months merged later)
    const headerRow = sheet.addRow(["Student Name", ...dates]); // row 2
    headerRow.font = { bold: true };
    sheet.mergeCells(1, 1, 2, 1);
    const nameHeaderCell = sheet.getCell(1, 1);
    nameHeaderCell.value = "Student Name";
    nameHeaderCell.alignment = { vertical: "middle", horizontal: "center" };

    monthGroups.forEach(({ label, start, end }) => {
      const startCol = 2 + start;
      const endCol = 2 + end;
      sheet.mergeCells(1, startCol, 1, endCol);
      const cell = sheet.getCell(1, startCol);
      cell.value = label;
      cell.font = { bold: true };
      cell.alignment = { vertical: "middle", horizontal: "center" };
    });

    // Data rows
    students.forEach(([studentId, studentName]) => {
      const row = [studentName];
      dates.forEach((dateKey) => {
        const rec = records.find(
          (r) =>
            String(r.student?._id || r.student) === studentId &&
            localDateKey(r.date) === dateKey
        );
        row.push(rec ? `${rec.status}${rec.remarks ? ` (${rec.remarks})` : ""}` : "");
      });
      sheet.addRow(row);
    });

    // Styling
    sheet.columns = headerRow.values.map(() => ({ width: 18 }));
    sheet.eachRow((row, idx) => {
      row.alignment = { vertical: "middle", horizontal: "center" };
      if (idx >= 3) {
        row.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: idx % 2 === 0 ? "FFEFEFEF" : "FFFFFFFF" },
        };
      }
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" }, left: { style: "thin" },
          bottom: { style: "thin" }, right: { style: "thin" },
        };
      });
    });

    // Filename based on first/last date in the export
    const first = new Date(dates[0]);
    const last  = new Date(dates[dates.length - 1]);
    const sameMonth = first.getFullYear() === last.getFullYear() && first.getMonth() === last.getMonth();
    let fileName;
    if (sameMonth) {
      fileName = `${batchName}_${first.toLocaleString("en-US", { month: "long" })}_${first.getFullYear()}.xlsx`;
    } else {
      const a = `${first.toLocaleString("en-US", { month: "short" })}${first.getFullYear()}`;
      const b = `${last.toLocaleString("en-US", { month: "short" })}${last.getFullYear()}`;
      fileName = `${batchName}_${a}_to_${b}.xlsx`;
    }

    // Response headers and stream
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("exportAttendanceExcel error:", err);
    // Surface a helpful message
    res.status(500).json({ message: "Failed to export Excel", error: err.message });
  }
};


