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

// import ExcelJS from "exceljs";
// import { getFilteredAttendance } from "../services/attendance.service.js";

export const exportAttendanceExcel = async (req, res) => {
  try {
    const { year, month, period } = req.query;

    // 1) Fetch records first
    const records = await getFilteredAttendance(req.query);

    // 2) Compute date range
    const TZ_OFFSET_MIN = 330; // Asia/Kolkata
    const TZ_OFFSET_MS = TZ_OFFSET_MIN * 60 * 1000;

    let start = null, end = null;

    const now = new Date();
    const yNow = now.getFullYear();
    const mNow = now.getMonth();

    if (period === "3m" || period === "6m") {
      const months = period === "3m" ? 3 : 6;

      // end = first day of next month (local IST)
      const endUTC = Date.UTC(yNow, mNow + 1, 1, 0, 0, 0, 0);
      end = new Date(endUTC - TZ_OFFSET_MS);

      // start = first day of (currentMonth - (months - 1))
      const anchor = new Date(Date.UTC(yNow, mNow, 1, 0, 0, 0, 0));
      anchor.setMonth(anchor.getMonth() - (months - 1));
      start = new Date(anchor.getTime() - TZ_OFFSET_MS);
    } else if (year && month) {
      const y = Number(year);
      const m = Number(month) - 1;
      const startUTC = Date.UTC(y, m, 1, 0, 0, 0, 0);
      const endUTC = Date.UTC(y, m + 1, 1, 0, 0, 0, 0);
      start = new Date(startUTC - TZ_OFFSET_MS);
      end = new Date(endUTC - TZ_OFFSET_MS);
    } else if (year) {
      const y = Number(year);
      const startUTC = Date.UTC(y, 0, 1, 0, 0, 0, 0);
      const endUTC = Date.UTC(y + 1, 0, 1, 0, 0, 0, 0);
      start = new Date(startUTC - TZ_OFFSET_MS);
      end = new Date(endUTC - TZ_OFFSET_MS);
    } else if (month) {
      const m = Number(month) - 1;
      const startUTC = Date.UTC(yNow, m, 1, 0, 0, 0, 0);
      const endUTC = Date.UTC(yNow, m + 1, 1, 0, 0, 0, 0);
      start = new Date(startUTC - TZ_OFFSET_MS);
      end = new Date(endUTC - TZ_OFFSET_MS);
    }

    // 3) Apply range filter
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

    // 4) ExcelJS workbook
    const workbook = new ExcelJS.Workbook();

    // Batch name
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

    const localDateKey = (value) => {
      const d = new Date(value);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    // Unique dates
    const dates = [...new Set(filteredRecords.map(r => localDateKey(r.date)))].sort();

    // Unique students
    const students = [
      ...new Map(filteredRecords.map(r => [r.student._id.toString(), r.student.name])).entries()
    ];

    // Month groups
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

    // Headers
    const monthHeaderRow = sheet.addRow(["Student Name", ...dates.map(() => "")]);
    const headerRow = sheet.addRow(["Student Name", ...dates]);
    headerRow.font = { bold: true };
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
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    });

    // Data rows
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

    sheet.columns = headerRow.values.map(() => ({ width: 20 }));

    // Styles
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

    monthGroups.forEach(({ start }) => {
      const startCol = 2 + start;
      for (let r = 1; r <= sheet.rowCount; r++) {
        const cell = sheet.getRow(r).getCell(startCol);
        cell.border = { ...cell.border, left: { style: "thick" } };
      }
    });

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

    // Filename
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
    console.error("exportAttendanceExcel error:", err);
    res.status(500).json({ message: "Failed to export Excel", error: err.message });
  }
};


