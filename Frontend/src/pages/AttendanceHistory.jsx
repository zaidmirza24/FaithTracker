import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";
import { API_BASE } from "../config/api";

const AttendanceHistory = () => {
  const { batchId } = useParams();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const currentYear = new Date().getFullYear().toString();
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState("");
  const [period, setPeriod] = useState("");

  const token = localStorage.getItem("token");

  const buildFilterParams = () => {
    const params = {};
    if (period) {
      params.period = period;
      return params;
    }
    const y = typeof year === "string" ? year.trim() : year;
    if (y && /^\d{4}$/.test(String(y))) params.year = String(y);

    if (month !== "" && !Number.isNaN(Number(month))) {
      const m = Number(month);
      if (m >= 1 && m <= 12) params.month = String(m);
    }
    return params;
  };

  const fetchHistory = async () => {
    if (!batchId) return;
    setLoading(true);
    try {
      const url = `${API_BASE}/teacher/attendance/history/${batchId}`;
      const params = { ...buildFilterParams(), _: Date.now() };
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      setRecords(Array.isArray(res.data) ? res.data : []);
      setError("");
    } catch (err) {
      setRecords([]);
      setError(err?.response?.data?.message || "Failed to fetch attendance history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId]);

  useEffect(() => {
    if (!batchId) return;
    const t = setTimeout(() => fetchHistory(), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, period]);

  const onKeyDownFilter = (e) => {
    if (e.key === "Enter") fetchHistory();
  };

  const getStatusBadge = (status = "") => {
    const s = status.toLowerCase();
    if (s === "present") return "bg-emerald-100 text-emerald-800 border-emerald-200";
    if (s === "absent") return "bg-red-100 text-red-800 border-red-200";
    if (s === "late") return "bg-amber-100 text-amber-800 border-amber-200";
    if (s === "excused") return "bg-sky-100 text-sky-800 border-sky-200";
    return "bg-gray-100 text-gray-800 border-gray-200";
  };

  const exportExcel = async () => {
    if (!batchId) return;
    try {
      const p = buildFilterParams();
      const qs = new URLSearchParams({ batchId, ...p }).toString();
      const url = `${API_BASE}/reports/export?${qs}`;
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });

      const cd = res.headers["content-disposition"] || res.headers["Content-Disposition"];
      let filename = "attendance.xlsx";
      if (cd) {
        let m = cd.match(/filename="([^"]+)"/);
        if (!m) m = cd.match(/filename=([^;]+)/);
        if (m?.[1]) filename = m[1].trim();
      }

      const blob = new Blob([res.data], {
        type:
          res.headers["content-type"] ||
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error("Excel Export Error:", err);
      alert(err?.response?.data?.message || "Failed to export Excel");
    }
  };

  // (kept) Old groupedByMonth (unused below, left intact to avoid touching logic)
  const groupedByMonth = useMemo(() => {
    const sorted = [...records].sort((a, b) => new Date(a.date) - new Date(b.date));
    const groups = [];
    const map = {};
    for (const rec of sorted) {
      const d = new Date(rec.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleString("default", { month: "long", year: "numeric" });
      if (!map[key]) {
        map[key] = { key, label, items: [] };
        groups.push(map[key]);
      }
      map[key].items.push(rec);
    }
    return groups;
  }, [records]);

  // --- NEW: display name helper with deleted tag ---
  const getStudentDisplayName = (rec) => {
    const populatedName = rec?.student?.name;
    const snapName =
      rec?.studentName ||
      rec?.student_name ||
      rec?.studentNameSnapshot ||
      rec?.student_name_snapshot;

    if (populatedName) return populatedName;             // active student
    if (snapName) return `${snapName} (deleted)`;        // deleted but snapshot known
    return "Unknown (deleted)";                          // fallback
  };

  // --- NEW: Group by MONTH -> DATE (DESC so current month/dates on top) ---
  const groupedByMonthAndDate = useMemo(() => {
    // newest first
    const sorted = [...records].sort((a, b) => new Date(b.date) - new Date(a.date));

    const monthMap = new Map();
    for (const rec of sorted) {
      const d = new Date(rec.date);

      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const monthLabel = d.toLocaleString("default", { month: "long", year: "numeric" });

      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, { key: monthKey, label: monthLabel, dateMap: new Map() });
      }
      const monthObj = monthMap.get(monthKey);

      const dateKey = d.toISOString().slice(0, 10); // YYYY-MM-DD
      const dateLabel = d.toLocaleDateString("en-US", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
      });

      if (!monthObj.dateMap.has(dateKey)) {
        monthObj.dateMap.set(dateKey, { key: dateKey, label: dateLabel, items: [] });
      }
      monthObj.dateMap.get(dateKey).items.push(rec);
    }

    const months = [];
    for (const { key, label, dateMap } of monthMap.values()) {
      const dateGroups = Array.from(dateMap.values());
      // keep DESC by date
      dateGroups.sort((a, b) => new Date(b.key) - new Date(a.key));

      // per-date totals
      dateGroups.forEach((g) => {
        const totals = { Present: 0, Absent: 0, Late: 0, Excused: 0 };
        g.items.forEach((it) => {
          if (totals[it.status] !== undefined) totals[it.status] += 1;
        });
        g.totals = totals;
        g.count = g.items.length;
      });

      months.push({ key, label, dateGroups });
    }

    return months;
  }, [records]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        <div className="w-12 h-12 border-4 border-t-transparent border-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 px-6 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Attendance History
            </h1>
            <p className="text-gray-600 mt-1">
              Complete list of past attendance records for this batch
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            {/* Quick Range */}
            <div className="flex flex-col">
              <label className="text-sm font-semibold text-gray-700 mb-2">
                <span className="inline-flex items-center">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500 mr-2" />
                  Quick Range
                </span>
              </label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="px-4 py-3 bg-white/80 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-green-100 outline-none w-44"
              >
                <option value="">None</option>
                <option value="3m">Last 3 months</option>
                <option value="6m">Last 6 months</option>
              </select>
            </div>

            <div className="flex flex-col">
              <label className="text-sm font-semibold text-gray-700 mb-2">
                <span className="inline-flex items-center">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 mr-2" />
                  Year
                </span>
              </label>
              <input
                type="number"
                placeholder="2025"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                onKeyDown={onKeyDownFilter}
                disabled={!!period}
                className={`px-4 py-3 bg-white/80 border-2 rounded-xl w-40 focus:ring-4 focus:ring-blue-100 outline-none ${
                  period ? "opacity-60 cursor-not-allowed" : "border-gray-200"
                }`}
              />
            </div>

            <div className="flex flex-col">
              <label className="text-sm font-semibold text-gray-700 mb-2">
                <span className="inline-flex items-center">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500 mr-2" />
                  Month
                </span>
              </label>
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                onKeyDown={onKeyDownFilter}
                disabled={!!period}
                className={`px-4 py-3 bg-white/80 border-2 rounded-xl w-44 focus:ring-4 focus:ring-purple-100 outline-none ${
                  period ? "opacity-60 cursor-not-allowed" : "border-gray-200"
                }`}
              >
                <option value="">All Months</option>
                {[...Array(12)].map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(0, i).toLocaleString("default", { month: "long" })}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end gap-3">
              <button
                onClick={fetchHistory}
                disabled={loading}
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? "Loading..." : "Filter"}
              </button>

              {batchId && records.length > 0 && (
                <button
                  onClick={exportExcel}
                  className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-500 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
                >
                  📊 Export Excel
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-800 shadow-lg">
            <div className="flex items-center">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 mr-3" />
              {error}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!error && records.length === 0 ? (
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/50 p-10 text-center">
            <div className="text-6xl mb-3">📊</div>
            <p className="text-gray-700 text-lg">No attendance records found.</p>
            <p className="text-gray-500">Try adjusting your filters.</p>
          </div>
        ) : null}

        {/* Table */}
        {records.length > 0 && (
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/50 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Records</h2>
                  <p className="text-gray-600 text-sm mt-1">
                    {records.length} entr{records.length === 1 ? "y" : "ies"}
                  </p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50/80">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 border-b border-gray-200">
                      Date
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 border-b border-gray-200">
                      Student
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 border-b border-gray-200">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 border-b border-gray-200">
                      Remarks
                    </th>
                  </tr>
                </thead>

                {/* Month header → Date header w/ totals → Rows */}
                <tbody className="divide-y divide-gray-200">
                  {groupedByMonthAndDate.map((month) => (
                    <React.Fragment key={month.key}>
                      {/* Month header row */}
                      <tr>
                        <td
                          colSpan={4}
                          className="px-6 py-3 bg-slate-200 text-slate-900 font-semibold border-y border-slate-200 text-lg"
                        >
                          {month.label}
                        </td>
                      </tr>

                      {month.dateGroups.map((dg) => (
                        <React.Fragment key={dg.key}>
                          {/* Date header with totals */}
                          <tr>
                            <td
                              colSpan={4}
                              className="px-6 py-2 bg-slate-50 text-slate-800 border-y border-slate-200"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-medium">{dg.label}</span>
                                <div className="flex gap-2 text-xs">
                                  <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    Present: {dg.totals.Present}
                                  </span>
                                  <span className="px-2 py-1 rounded-full bg-red-100 text-red-800 border border-red-200">
                                    Absent: {dg.totals.Absent}
                                  </span>
                                  <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                                    Late: {dg.totals.Late}
                                  </span>
                                  {dg.totals.Excused > 0 && (
                                    <span className="px-2 py-1 rounded-full bg-sky-100 text-sky-800 border border-sky-200">
                                      Excused: {dg.totals.Excused}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>

                          {/* Rows for this date */}
                          {dg.items.map((rec) => (
                            <tr key={rec._id} className="hover:bg-white/60 transition-colors duration-150">
                              <td className="px-6 py-4 text-sm text-gray-500">—</td>
                              <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                {getStudentDisplayName(rec)}
                              </td>
                              <td className="px-6 py-4 text-sm">
                                <span
                                  className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full border ${getStatusBadge(
                                    rec.status
                                  )}`}
                                >
                                  {rec.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600">
                                {rec.remarks || "—"}
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AttendanceHistory;
