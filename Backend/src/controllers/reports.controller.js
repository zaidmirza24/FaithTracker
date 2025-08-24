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
    const filters = req.query;
    const records = await getFilteredAttendance(filters);

    // ── ENFORCE IST FILTER LOCALLY (if service didn't) ───────────────────────
    const { year, month } = req.query;

    const TZ_OFFSET_MIN = 330; // Asia/Kolkata
    const TZ_OFFSET_MS  = TZ_OFFSET_MIN * 60 * 1000;

    const yNum = year && /^\d{4}$/.test(String(year)) ? Number(year) : null;
    const mNum = month != null && month !== "" && !Number.isNaN(Number(month))
      ? Number(month)
      : null;

    let start = null, end = null;
    if (yNum && mNum && mNum >= 1 && mNum <= 12) {
      // [YYYY-MM-01 00:00 IST, YYYY-(MM+1)-01 00:00 IST)
      const startUTC = Date.UTC(yNum, mNum - 1, 1, 0, 0, 0, 0);
      const endUTC   = Date.UTC(yNum, mNum,     1, 0, 0, 0, 0);
      start = new Date(startUTC - TZ_OFFSET_MS);
      end   = new Date(endUTC   - TZ_OFFSET_MS);
    } else if (yNum) {
      // Whole year in IST
      const startUTC = Date.UTC(yNum,     0, 1, 0, 0, 0, 0);
      const endUTC   = Date.UTC(yNum + 1, 0, 1, 0, 0, 0, 0);
      start = new Date(startUTC - TZ_OFFSET_MS);
      end   = new Date(endUTC   - TZ_OFFSET_MS);
    } else if (mNum && mNum >= 1 && mNum <= 12) {
      // Month without year → assume current IST year
      const nowYearUTC = new Date().getUTCFullYear();
      const startUTC = Date.UTC(nowYearUTC, mNum - 1, 1, 0, 0, 0, 0);
      const endUTC   = Date.UTC(nowYearUTC, mNum,     1, 0, 0, 0, 0);
      start = new Date(startUTC - TZ_OFFSET_MS);
      end   = new Date(endUTC   - TZ_OFFSET_MS);
    }

    let filteredRecords = records;
    if (start && end) {
      const startMs = start.getTime();
      const endMs = end.getTime();
      filteredRecords = records.filter(r => {
        const t = new Date(r.date).getTime();
        return t >= startMs && t < endMs;
      });
    }

    if (!filteredRecords.length) {
      return res.status(404).json({ message: "No records to export" });
    }
    // ─────────────────────────────────────────────────────────────────────────

    const workbook = new ExcelJS.Workbook();

    // Keep your existing sheet naming logic (use filteredRecords[0])
    let batchName = "Attendance";
    if (filteredRecords[0].batch?.name) {
      batchName = filteredRecords[0].batch.name.trim().replace(/\s+/g, "_");
    } else if (filteredRecords[0].batchName) {
      batchName = filteredRecords[0].batchName.trim().replace(/\s+/g, "_");
    } else if (filteredRecords[0].batch_name) {
      batchName = filteredRecords[0].batch_name.trim().replace(/\s+/g, "_");
    } else if (filteredRecords[0].class?.name) {
      batchName = filteredRecords[0].class.name.trim().replace(/\s+/g, "_");
    } else if (filteredRecords[0].className) {
      batchName = filteredRecords[0].className.trim().replace(/\s+/g, "_");
    }

    const sheet = workbook.addWorksheet(batchName);

    // Local date key helper (keeps your existing formatting)
    const localDateKey = (value) => {
      const d = new Date(value);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`; // YYYY-MM-DD in server's local time
    };

    // 1) Unique dates (sorted) — from filteredRecords
    const dates = [...new Set(filteredRecords.map(r => localDateKey(r.date)))].sort();

    // 2) Unique students — from filteredRecords
    const students = [
      ...new Map(filteredRecords.map(r => [r.student._id.toString(), r.student.name])).entries()
    ];

    // 3) Month groups over dates for visual separation
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

    // ── Headers
    const monthHeaderRow = sheet.addRow(["Student Name", ...dates.map(() => "")]);
    const headerRow = sheet.addRow(["Student Name", ...dates]);
    headerRow.font = { bold: true };

    // Merge A1:A2 (Student Name)
    sheet.mergeCells(1, 1, 2, 1);
    const nameHeaderCell = sheet.getCell(1, 1);
    nameHeaderCell.value = "Student Name";
    nameHeaderCell.alignment = { vertical: "middle", horizontal: "center" };

    // Merge month blocks in row 1
    monthGroups.forEach(({ label, start, end }) => {
      const startCol = 2 + start;
      const endCol = 2 + end;
      sheet.mergeCells(1, startCol, 1, endCol);
      const cell = sheet.getCell(1, startCol);
      cell.value = label;
      cell.font = { bold: true };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    });

    // Data rows (start at row 3) — lookup from filteredRecords
    students.forEach(([studentId, studentName]) => {
      const row = [studentName];

      dates.forEach((dateKey) => {
        const rec = filteredRecords.find(
          (r) =>
            r.student._id.toString() === studentId &&
            localDateKey(r.date) === dateKey
        );
        row.push(rec ? `${rec.status}${rec.remarks ? ` (${rec.remarks})` : ""}` : "");
      });

      sheet.addRow(row);
    });

    // Column widths
    sheet.columns = headerRow.values.map(() => ({ width: 20 }));

    // Alignment + zebra for data rows only
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

    // Thin borders for all cells
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });
    });

    // Thick left border at the start of each month block
    monthGroups.forEach(({ start }) => {
      const startCol = 2 + start; // first date column of that month
      for (let r = 1; r <= sheet.rowCount; r++) {
        const cell = sheet.getRow(r).getCell(startCol);
        cell.border = { ...cell.border, left: { style: "thick" } };
      }
    });

    // Color-code Present/Absent cells
    const firstDataRow = 3;
    const lastCol = 1 + dates.length; // A=1, dates start at col 2
    for (let r = firstDataRow; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      for (let c = 2; c <= lastCol; c++) {
        const cell = row.getCell(c);
        const text = String(cell.value ?? "");
        if (text.startsWith("Present")) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD1FAE5" } }; // green-100
        } else if (text.startsWith("Absent")) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } }; // red-100
        }
      }
    }

    // Filename logic (unchanged)
    const sortedDates = [...dates];
    const startDate = new Date(sortedDates[0]);
    const endDate = new Date(sortedDates[sortedDates.length - 1]);
    const isSameMonth =
      startDate.getMonth() === endDate.getMonth() &&
      startDate.getFullYear() === endDate.getFullYear();

    let fileName;
    if (isSameMonth) {
      const monthName = startDate.toLocaleString("en-US", { month: "long" });
      const yearNum = startDate.getFullYear();
      fileName = `${batchName}_${monthName}_${yearNum}.xlsx`;
    } else {
      const startMonth = startDate.toLocaleString("en-US", { month: "short" });
      const endMonth = endDate.toLocaleString("en-US", { month: "short" });
      const startYear = startDate.getFullYear();
      const endYear = endDate.getFullYear();

      if (startYear === endYear) {
        fileName = `${batchName}_${startMonth}_to_${endMonth}_${startYear}.xlsx`;
      } else {
        fileName = `${batchName}_${startMonth}${startYear}_to_${endMonth}${endYear}.xlsx`;
      }
    }

    // Headers
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ message: "Failed to export Excel", error: err.message });
  }
};


