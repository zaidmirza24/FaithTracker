import React, { useEffect, useState, useMemo } from "react";
import { API_BASE } from "../config/api.js";
import axios from "axios";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import { useNavigate } from "react-router-dom";

const AdminDashboard = () => {
  const [cities, setCities] = useState([]);
  const [selectedCity, setSelectedCity] = useState("");
  const [teachers, setTeachers] = useState([]);
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState("");
  const [attendance, setAttendance] = useState([]);
  const [summaryData, setSummaryData] = useState([]);

  // ✅ NEW: Quick range add-on ("" | "3m" | "6m")
  const [period, setPeriod] = useState("");

  const currentYear = new Date().getFullYear().toString();
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  // --- Helper to display student names, including deleted ---
  const getStudentDisplayName = (rec) => {
    if (rec?.student?.name) return rec.student.name;            // active & populated
    if (rec?.studentName)   return `${rec.studentName} (deleted)`; // snapshot saved on attendance
    return "Unknown (deleted)";                                  // no snapshot available
  };

  // Fetch cities
  useEffect(() => {
    const fetchCities = async () => {
      try {
        const res = await axios.get(`${API_BASE}/admin/cities`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setCities((res.data || []).filter(Boolean));
      } catch (err) {
        setError(err.response?.data?.message || "Failed to fetch cities");
      }
    };
    fetchCities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch teachers
  useEffect(() => {
    if (!selectedCity) return;
    const fetchTeachers = async () => {
      try {
        const res = await axios.get(
          `${API_BASE}/admin/cities/${selectedCity}/teachers`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setTeachers((res.data || []).filter(Boolean));
        setSelectedTeacher("");
        setBatches([]);
        setSelectedBatch("");
        setAttendance([]);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to fetch teachers");
      }
    };
    fetchTeachers();
  }, [selectedCity]);

  // Fetch batches
  useEffect(() => {
    if (!selectedTeacher) return;
    const fetchBatches = async () => {
      try {
        const res = await axios.get(
          `${API_BASE}/admin/teachers/${selectedTeacher}/batches`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setBatches((res.data || []).filter(Boolean));
        setSelectedBatch("");
        setAttendance([]);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to fetch batches");
      }
    };
    fetchBatches();
  }, [selectedTeacher]);

  // Helper to build query strings consistently
  const buildQuery = (base, includeBatch = true) => {
    const params = [];
    if (includeBatch && selectedBatch) params.push(`batchId=${selectedBatch}`);
    if (period) {
      params.push(`period=${period}`);
    } else {
      if (year) params.push(`year=${year}`);
      if (month) params.push(`month=${month}`);
    }
    const qs = params.length ? `?${params.join("&")}` : "";
    return `${base}${qs}`;
  };

  // Fetch attendance and summary
  const fetchAttendance = async () => {
    // Only enforce Y/M when NO quick range is selected
    if (!period && !year && !month && selectedBatch) {
      alert("Select a Year/Month or choose a Quick Range (3m/6m).");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const listUrl = buildQuery(`${API_BASE}/admin/attendance`);
      const res = await axios.get(listUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAttendance((res.data || []).filter(Boolean));

      const summaryUrl = buildQuery(`${API_BASE}/reports/summary`);
      const summaryRes = await axios.get(summaryUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSummaryData((summaryRes.data || []).filter(Boolean));
    } catch (err) {
      setError(
        err.response?.data?.message || "Failed to fetch attendance or summary"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  // Export Excel (respects quick range OR year/month)
  const exportExcel = async () => {
    if (!selectedBatch) return alert("Select a batch first!");
    try {
      const url = buildQuery(`${API_BASE}/reports/export`);
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });

      const contentDisposition =
        res.headers["content-disposition"] || res.headers["Content-Disposition"];
      let filename = "attendance.xlsx";
      if (contentDisposition) {
        let filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
        if (!filenameMatch)
          filenameMatch = contentDisposition.match(/filename=([^;]+)/);
        if (filenameMatch) filename = filenameMatch[1].trim();
      }

      const blob = new Blob([res.data], {
        type:
          res.headers["content-type"] ||
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error("Excel Export Error:", err);
      alert("Failed to export Excel");
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "present":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "absent":
        return "bg-red-100 text-red-800 border-red-200";
      case "late":
        return "bg-amber-100 text-amber-800 border-amber-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  // --- NEW: Group by MONTH -> DATE (sorted newest → oldest so current is on top) ---
  const groupedByMonthAndDate = useMemo(() => {
    // newest first
    const sorted = [...attendance].sort((a, b) => new Date(b.date) - new Date(a.date));

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
  }, [attendance]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Navbar / Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-10">
        <div
          className="
            max-w-7xl mx-auto 
            px-4 sm:px-6 py-4 
            flex flex-col sm:flex-row sm:items-center sm:justify-between
            gap-3
          "
        >
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Admin Dashboard
            </h1>
            <p className="text-gray-600 mt-1 text-sm sm:text-base">
              Manage attendance and generate reports
            </p>
          </div>

          {/* Nav actions — responsive & non-overflowing */}
          <div
            className="
              w-full sm:w-auto
              flex flex-wrap sm:flex-nowrap
              justify-stretch sm:justify-end
              items-stretch sm:items-center
              gap-2 sm:gap-3 mt-1 sm:mt-0
            "
          >
            <button
              onClick={() => navigate("/admin/create-teacher")}
              className="w-full sm:w-auto px-3 sm:px-4 py-2 text-sm sm:text-base bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold rounded-xl shadow-md hover:shadow-lg hover:scale-[1.02] transition-all duration-200"
            >
              + Create Teacher
            </button>

            <button
              onClick={() => navigate("/reports")}
              className="w-full sm:w-auto px-3 sm:px-4 py-2 text-sm sm:text-base bg-gradient-to-r from-emerald-500 to-green-500 text-white font-semibold rounded-xl shadow-md hover:shadow-lg hover:scale-[1.02] transition-all duration-200"
            >
              Generate Report
            </button>

            <button
              onClick={handleLogout}
              className="w-full sm:w-auto px-3 sm:px-4 py-2 text-sm sm:text-base bg-gradient-to-r from-red-500 to-pink-500 text-white font-semibold rounded-xl shadow-md hover:shadow-lg hover:scale-[1.02] transition-all duration-200"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-red-500 rounded-full mr-3" />
              {error}
            </div>
          </div>
        )}

        {/* Selection Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-8">
          {/* City */}
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-5 sm:p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-white/50">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              <span className="inline-flex items-center">
                <span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
                Select City
              </span>
            </label>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="w-full px-4 py-3 bg-white/80 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-400 transition-all duration-200 text-gray-800"
            >
              <option value="">-- Choose City --</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Teacher */}
          {teachers.length > 0 && (
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-5 sm:p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-white/50">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                <span className="inline-flex items-center">
                  <span className="w-3 h-3 bg-purple-500 rounded-full mr-2"></span>
                  Select Teacher
                </span>
              </label>
              <select
                value={selectedTeacher}
                onChange={(e) => setSelectedTeacher(e.target.value)}
                className="w-full px-4 py-3 bg-white/80 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-purple-100 focus:border-purple-400 transition-all duration-200 text-gray-800"
              >
                <option value="">-- Choose Teacher --</option>
                {teachers.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t?.name ?? "Unknown"}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Batch */}
          {batches.length > 0 && (
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-5 sm:p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-white/50">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                <span className="inline-flex items-center">
                  <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                  Select Batch
                </span>
              </label>
              <select
                value={selectedBatch}
                onChange={(e) => setSelectedBatch(e.target.value)}
                className="w-full px-4 py-3 bg-white/80 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-green-100 focus:border-green-400 transition-all duration-200 text-gray-800"
              >
                <option value="">-- Choose Batch --</option>
                {batches.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b?.name ?? "Unknown"}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Filters & Actions */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-5 sm:p-6 shadow-lg border border-white/50 mb-8">
          <div className="flex flex-wrap gap-4 items-end">
            {/* ✅ Quick Range add-on */}
            <div className="min-w-40">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Quick Range
              </label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="w-full px-4 py-3 bg-white/80 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-400 transition-all duration-200"
              >
                <option value="">None</option>
                <option value="3m">Last 3 months</option>
                <option value="6m">Last 6 months</option>
              </select>
            </div>

            <div className="flex-1 min-w-32">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Year
              </label>
              <input
                type="number"
                placeholder="2025"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                disabled={!!period}
                className={`w-full px-4 py-3 bg-white/80 border-2 rounded-xl focus:ring-4 focus:ring-blue-100 transition-all duration-200 ${
                  period ? "border-gray-200 opacity-70 cursor-not-allowed" : "border-gray-200 focus:border-blue-400"
                }`}
              />
            </div>

            <div className="flex-1 min-w-40">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Month
              </label>
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                disabled={!!period}
                className={`w-full px-4 py-3 bg-white/80 border-2 rounded-xl focus:ring-4 focus:ring-blue-100 transition-all duration-200 ${
                  period ? "border-gray-200 opacity-70 cursor-not-allowed" : "border-gray-200 focus:border-blue-400"
                }`}
              >
                <option value="">All Months</option>
                {[...Array(12)].fill(null).map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(0, i).toLocaleString("default", { month: "long" })}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
              <button
                onClick={fetchAttendance}
                disabled={loading}
                className="w-full sm:w-auto px-5 sm:px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                    Loading...
                  </div>
                ) : (
                  "Filter Data"
                )}
              </button>

              {selectedBatch && attendance.length > 0 && (
                <button
                  onClick={exportExcel}
                  className="w-full sm:w-auto px-5 sm:px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-500 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
                >
                  📊 Export Excel
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Attendance Table */}
        {selectedBatch && (
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/50 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-800">Attendance Records</h2>
              <p className="text-gray-600 text-sm mt-1">
                {attendance.length} record{attendance.length !== 1 ? "s" : ""} found
              </p>
            </div>

            {loading ? (
              <div className="p-12 text-center">
                <div className="inline-flex items-center">
                  <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mr-3"></div>
                  <span className="text-gray-600 text-lg">
                    Loading attendance data...
                  </span>
                </div>
              </div>
            ) : attendance.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <div className="text-6xl mb-4">📊</div>
                <p className="text-lg">No attendance records found</p>
                <p className="text-sm">Try adjusting your filters</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
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

                  {/* --- NEW BODY RENDERING: Month header → Date sections → Rows --- */}
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
                              <tr key={rec._id} className="hover:bg-white/50 transition-colors duration-150">
                                <td className="px-6 py-4 text-sm text-gray-500"></td>
                                <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                  {getStudentDisplayName(rec)}
                                </td>
                                <td className="px-6 py-4 text-sm">
                                  <span
                                    className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full border ${getStatusColor(
                                      rec.status
                                    )}`}
                                  >
                                    {rec.status}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600">
                                  {rec.remarks || "-"}
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
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
