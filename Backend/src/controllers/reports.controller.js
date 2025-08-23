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

    if (!records.length) return res.status(404).json({ message: "No records to export" });

    const workbook = new ExcelJS.Workbook();

    // Keep your existing sheet naming logic
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

    // ✅ Local date key helper (no UTC conversion)
    const localDateKey = (value) => {
      const d = new Date(value);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`; // YYYY-MM-DD in local time
    };

    // 1) Unique local-date keys
    const dates = [...new Set(records.map(r => localDateKey(r.date)))].sort();

    // 2) Unique students
    const students = [
      ...new Map(records.map(r => [r.student._id.toString(), r.student.name])).entries()
    ];

    // 3) Header
    const headerRow = ["Student Name", ...dates];
    sheet.addRow(headerRow).font = { bold: true };

    // 4) Rows
    students.forEach(([studentId, studentName]) => {
      const row = [studentName];

      dates.forEach(dateKey => {
        const rec = records.find(r =>
          r.student._id.toString() === studentId &&
          localDateKey(r.date) === dateKey
        );
        row.push(rec ? `${rec.status}${rec.remarks ? ` (${rec.remarks})` : ""}` : "");
      });

      sheet.addRow(row);
    });

    // Widths
    sheet.columns = headerRow.map(() => ({ width: 20 }));

    // Styles
    sheet.eachRow((row, rowNumber) => {
      row.alignment = { vertical: "middle", horizontal: "center" };
      if (rowNumber > 1) {
        row.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: rowNumber % 2 === 0 ? "FFEFEFEF" : "FFFFFFFF" }
        };
      }
    });

    // Borders
    sheet.eachRow(row => {
      row.eachCell(cell => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" }
        };
      });
    });

    // ✅ Your existing filename logic preserved
    const sortedDates = dates.sort();
    const startDate = new Date(sortedDates[0]);
    const endDate = new Date(sortedDates[sortedDates.length - 1]);
    const isSameMonth =
      startDate.getMonth() === endDate.getMonth() &&
      startDate.getFullYear() === endDate.getFullYear();

    let fileName;
    if (isSameMonth) {
      const month = startDate.toLocaleString("en-US", { month: "long" });
      const year = startDate.getFullYear();
      fileName = `${batchName}_${month}_${year}.xlsx`;
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

    // Headers (with cache busting)
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
