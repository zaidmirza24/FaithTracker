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
  const token = localStorage.getItem("token");

  // Build safe params (no behavior change to your fields)
  const buildFilterParams = () => {
    const params = {};
    const y = (typeof year === "string" ? year.trim() : year);
    if (y && /^\d{4}$/.test(String(y))) params.year = String(y);

    if (month !== "" && !Number.isNaN(Number(month))) {
      const m = Number(month);
      if (m >= 1 && m <= 12) params.month = String(m); // 1..12
    }
    return params;
  };

  const fetchHistory = async () => {
    if (!batchId) return;
    setLoading(true);
    try {
      const url = `${API_BASE}/teacher/attendance/history/${batchId}`;
      const params = { ...buildFilterParams(), _: Date.now() }; // cache-buster
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

  // Initial fetch on mount / batch change
  useEffect(() => {
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId]);

  // 🔁 Debounced auto-fetch when year/month change (so filters "work" immediately)
  useEffect(() => {
    if (!batchId) return;
    const t = setTimeout(() => {
      fetchHistory();
    }, 300); // small debounce to avoid firing on every keystroke
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  const onKeyDownFilter = (e) => {
    if (e.key === "Enter") fetchHistory();
  };

  const getStatusBadge = (status = "") => {
    const s = status.toLowerCase();
    if (s === "present") return "bg-emerald-100 text-emerald-800 border-emerald-200";
    if (s === "absent")  return "bg-red-100 text-red-800 border-red-200";
    if (s === "late")    return "bg-amber-100 text-amber-800 border-amber-200";
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
        headers: { Authorization: { toString: () => `Bearer ${token}` }.toString() || `Bearer ${token}` },
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
        type: res.headers["content-type"] || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
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
                className="px-4 py-3 bg-white/80 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 outline-none w-40"
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
                className="px-4 py-3 bg-white/80 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-purple-100 outline-none w-44"
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

        {/* Table card */}
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
                <tbody className="divide-y divide-gray-200">
                  {groupedByMonth.map((group) => (
                    <React.Fragment key={group.key}>
                      {/* Month separator row */}
                      <tr>
                        <td
                          colSpan={4}
                          className="px-6 py-3 bg-slate-100/80 text-slate-800 font-semibold border-y border-slate-200"
                        >
                          <div className="flex items-center justify-between">
                            <span>{group.label}</span>
                            <span className="text-xs text-slate-500">
                              {group.items.length} record{group.items.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                        </td>
                      </tr>

                      {/* Rows for this month */}
                      {group.items.map((rec) => (
                        <tr key={rec._id} className="hover:bg-white/60 transition-colors duration-150">
                          <td className="px-6 py-4 text-sm text-gray-800">
                            {new Date(rec.date).toLocaleDateString("en-US", {
                              weekday: "short",
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">
                            {rec.student?.name || "—"}
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
