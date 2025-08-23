import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  LineChart,
  Line,
} from "recharts";
import { API_BASE } from "../config/api";

const ADMIN_API = `${API_BASE}/admin`
const REPORTS_API = `${API_BASE}/reports`;

const STATUS_COLORS = {
  Present: "#10b981", // emerald
  Absent: "#ef4444",  // red
  Late: "#f59e0b",    // amber
  Excused: "#38bdf8", // sky
};

const Reports = () => {
  const token = localStorage.getItem("token");

  // Filters
  const [cities, setCities] = useState([]);
  const [selectedCity, setSelectedCity] = useState("");
  const [teachers, setTeachers] = useState([]);
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState("");

  // Default to current month
  const todayISO = new Date().toISOString().slice(0, 10);
  const firstOfMonthISO = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  )
    .toISOString()
    .slice(0, 10);

  const [fromDate, setFromDate] = useState(firstOfMonthISO);
  const [toDate, setToDate] = useState(todayISO);

  // Data + UI state
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Fetch cities
  useEffect(() => {
    const fetchCities = async () => {
      try {
        const res = await axios.get(`${ADMIN_API}/cities`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setCities(res.data || []);
      } catch (e) {
        setErr(e.response?.data?.message || "Failed to fetch cities");
      }
    };
    fetchCities();
  }, [token]);

  // Fetch teachers when city changes
  useEffect(() => {
    if (!selectedCity) {
      setTeachers([]);
      setSelectedTeacher("");
      setBatches([]);
      setSelectedBatch("");
      return;
    }
    const fetchTeachers = async () => {
      try {
        const res = await axios.get(
          `${ADMIN_API}/cities/${selectedCity}/teachers`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setTeachers(res.data || []);
        setSelectedTeacher("");
        setBatches([]);
        setSelectedBatch("");
      } catch (e) {
        setErr(e.response?.data?.message || "Failed to fetch teachers");
      }
    };
    fetchTeachers();
  }, [selectedCity, token]);

  // Fetch batches when teacher changes
  useEffect(() => {
    if (!selectedTeacher) {
      setBatches([]);
      setSelectedBatch("");
      return;
    }
    const fetchBatches = async () => {
      try {
        const res = await axios.get(
          `${ADMIN_API}/teachers/${selectedTeacher}/batches`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setBatches(res.data || []);
        setSelectedBatch("");
      } catch (e) {
        setErr(e.response?.data?.message || "Failed to fetch batches");
      }
    };
    fetchBatches();
  }, [selectedTeacher, token]);

  // Fetch attendance data
  const fetchData = async () => {
    setLoading(true);
    setErr("");
    try {
      const params = new URLSearchParams();
      if (selectedBatch) params.append("batchId", selectedBatch);
      if (selectedTeacher) params.append("teacherId", selectedTeacher);
      if (selectedCity) params.append("city", selectedCity);
      if (fromDate) params.append("startDate", fromDate);
      if (toDate) params.append("endDate", toDate);

      const url = `${ADMIN_API}/attendance?${params.toString()}`;
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAttendance(res.data || []);
    } catch (e) {
      setErr(e.response?.data?.message || "Failed to fetch report data");
      setAttendance([]);
    } finally {
      setLoading(false);
    }
  };

  // Export Excel using your /api/reports/export
  const exportExcel = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedBatch) params.append("batchId", selectedBatch);
      if (selectedTeacher) params.append("teacherId", selectedTeacher);
      if (selectedCity) params.append("city", selectedCity);
      if (fromDate) params.append("startDate", fromDate);
      if (toDate) params.append("endDate", toDate);

      const url = `${REPORTS_API}/export?${params.toString()}`;
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });

      const cd =
        res.headers["content-disposition"] ||
        res.headers["Content-Disposition"];
      let filename = "attendance.xlsx";
      if (cd) {
        let m = cd.match(/filename="([^"]+)"/) || cd.match(/filename=([^;]+)/);
        if (m) filename = m[1].trim();
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
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (e) {
      alert(e.response?.data?.message || "Failed to export Excel");
    }
  };

  // ------- Summaries & chart data
  const totals = useMemo(() => {
    const t = { Present: 0, Absent: 0, Late: 0, Excused: 0, total: 0 };
    attendance.forEach((r) => {
      if (t[r.status] !== undefined) t[r.status] += 1;
      t.total += 1;
    });
    return t;
  }, [attendance]);

  const pieData = useMemo(
    () =>
      ["Present", "Absent", "Late", "Excused"]
        .filter((k) => totals[k] > 0)
        .map((k) => ({ name: k, value: totals[k] })),
    [totals]
  );

  const monthlyBar = useMemo(() => {
    const bucket = {};
    attendance.forEach((r) => {
      const d = new Date(r.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        "0"
      )}`;
      if (!bucket[key]) bucket[key] = { present: 0, total: 0 };
      if (String(r.status).toLowerCase() === "present")
        bucket[key].present += 1;
      bucket[key].total += 1;
    });
    return Object.entries(bucket)
      .sort(([a], [b]) => (a > b ? 1 : -1))
      .map(([ym, v]) => {
        const [y, m] = ym.split("-");
        const label = new Date(Number(y), Number(m) - 1, 1).toLocaleString(
          "default",
          { month: "short", year: "numeric" }
        );
        return {
          month: label,
          rate: Number(((v.present / v.total) * 100).toFixed(1)),
        };
      });
  }, [attendance]);

  const lineTrend = useMemo(() => {
    const bucket = {};
    attendance.forEach((r) => {
      const d = new Date(r.date);
      const key = d.toISOString().slice(0, 10);
      if (!bucket[key]) bucket[key] = { present: 0, total: 0 };
      if (String(r.status).toLowerCase() === "present")
        bucket[key].present += 1;
      bucket[key].total += 1;
    });
    return Object.entries(bucket)
      .sort(([a], [b]) => (a > b ? 1 : -1))
      .map(([date, v]) => ({
        date: new Date(date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        rate: Number(((v.present / v.total) * 100).toFixed(1)),
      }));
  }, [attendance]);

  const heatmapData = useMemo(() => {
    const bucket = {};
    attendance.forEach((r) => {
      const key = new Date(r.date).toISOString().slice(0, 10);
      if (!bucket[key]) bucket[key] = { present: 0, total: 0 };
      if (String(r.status).toLowerCase() === "present")
        bucket[key].present += 1;
      bucket[key].total += 1;
    });
    return Object.entries(bucket)
      .sort(([a], [b]) => (a > b ? 1 : -1))
      .map(([date, v]) => ({ date, pct: v.total ? v.present / v.total : 0 }));
  }, [attendance]);

  const topByBatch = useMemo(() => {
    const bucket = {};
    attendance.forEach((r) => {
      const key = r.batch?._id || r.batch;
      if (!key) return;
      if (!bucket[key])
        bucket[key] = { name: r.batch?.name || "—", present: 0, total: 0 };
      if (String(r.status).toLowerCase() === "present")
        bucket[key].present += 1;
      bucket[key].total += 1;
    });
    const rows = Object.values(bucket).map((b) => ({
      name: b.name,
      rate: b.total ? Number(((b.present / b.total) * 100).toFixed(1)) : 0,
      total: b.total,
    }));
    return rows.sort((a, b) => b.rate - a.rate).slice(0, 5);
  }, [attendance]);

  const bottomByTeacher = useMemo(() => {
    const bucket = {};
    attendance.forEach((r) => {
      const key =
        r.batch?.teacher?._id ||
        r.batch?.teacher ||
        r.teacher?._id ||
        r.teacher;
      const teacherName =
        r.batch?.teacher?.name || r.teacher?.name || "—";
      if (!key) return;
      if (!bucket[key])
        bucket[key] = { name: teacherName, present: 0, total: 0 };
      if (String(r.status).toLowerCase() === "present")
        bucket[key].present += 1;
      bucket[key].total += 1;
    });
    const rows = Object.values(bucket).map((t) => ({
      name: t.name,
      rate: t.total ? Number(((t.present / t.total) * 100).toFixed(1)) : 0,
      total: t.total,
    }));
    return rows.sort((a, b) => a.rate - b.rate).slice(0, 5);
  }, [attendance]);

  const percent = (a, b) => (b ? ((a / b) * 100).toFixed(1) : "0.0");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 px-6 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/50 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Reports & Analytics
              </h1>
              <p className="text-gray-600 mt-1">
                Analyze attendance across cities, teachers, and batches
              </p>
            </div>
            <button
              onClick={exportExcel}
              disabled={attendance.length === 0}
              className="px-5 py-3 bg-gradient-to-r from-emerald-500 to-green-500 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:transform-none"
            >
              📊 Export Excel
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/50 p-6 mb-8">
          {err && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700">
              {err}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* City */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                City
              </label>
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="w-full px-4 py-3 bg-white/80 border-2 border-gray-200 rounded-xl"
              >
                <option value="">All</option>
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            {/* Teacher */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Teacher
              </label>
              <select
                value={selectedTeacher}
                onChange={(e) => setSelectedTeacher(e.target.value)}
                className="w-full px-4 py-3 bg-white/80 border-2 border-gray-200 rounded-xl"
              >
                <option value="">All</option>
                {teachers.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            {/* Batch */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Batch
              </label>
              <select
                value={selectedBatch}
                onChange={(e) => setSelectedBatch(e.target.value)}
                className="w-full px-4 py-3 bg-white/80 border-2 border-gray-200 rounded-xl"
              >
                <option value="">All</option>
                {batches.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            {/* From */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                From
              </label>
              <input
                type="date"
                value={fromDate}
                max={toDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-4 py-3 bg-white/80 border-2 border-gray-200 rounded-xl"
              />
            </div>
            {/* To */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                To
              </label>
              <input
                type="date"
                value={toDate}
                min={fromDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-4 py-3 bg-white/80 border-2 border-gray-200 rounded-xl"
              />
            </div>
          </div>
          <div className="mt-5">
            <button
              onClick={fetchData}
              disabled={loading}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl disabled:opacity-50"
            >
              {loading ? "Loading..." : "Fetch Report"}
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {["Present", "Absent", "Late", "Excused"].map((k) => (
            <div
              key={k}
              className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/50 p-6"
            >
              <p className="text-sm font-semibold text-gray-700">{k}</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{totals[k]}</p>
              <p className="text-gray-500 mt-1">
                {percent(totals[k], totals.total)}% of {totals.total || 0}
              </p>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
          {/* Pie Chart */}
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/50 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Status Distribution
            </h3>
            {pieData.length === 0 ? (
              <div className="text-center text-gray-500 py-10">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie dataKey="value" data={pieData} outerRadius={100} label>
                    {pieData.map((entry, idx) => (
                      <Cell
                        key={`cell-${idx}`}
                        fill={STATUS_COLORS[entry.name] || "#94a3b8"}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Monthly Bar */}
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/50 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Monthly Attendance Rate
            </h3>
            {monthlyBar.length === 0 ? (
              <div className="text-center text-gray-500 py-10">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monthlyBar}>
                  <XAxis dataKey="month" />
                  <YAxis unit="%" />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="rate" name="Attendance %" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Trend Line */}
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/50 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Daily Trend
            </h3>
            {lineTrend.length === 0 ? (
              <div className="text-center text-gray-500 py-10">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={lineTrend}>
                  <XAxis dataKey="date" />
                  <YAxis unit="%" />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="rate" name="Attendance %" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Heatmap-like grid */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/50 p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Daily Heatmap</h3>
          {heatmapData.length === 0 ? (
            <div className="text-center text-gray-500 py-10">No data</div>
          ) : (
            <div className="grid grid-cols-7 gap-2">
              {heatmapData.map((d) => {
                const intensity = Math.round(d.pct * 100);
                const bg =
                  intensity > 80
                    ? "bg-emerald-500"
                    : intensity > 60
                    ? "bg-emerald-400"
                    : intensity > 40
                    ? "bg-emerald-300"
                    : intensity > 20
                    ? "bg-emerald-200"
                    : "bg-gray-200";
                return (
                  <div
                    key={d.date}
                    title={`${d.date} • ${(d.pct * 100).toFixed(0)}% present`}
                    className={`h-8 rounded-lg ${bg}`}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Tables: Top Batches / Bottom Teachers */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Batches */}
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/50 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">
                Top Batches (by % Present)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50/80">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                      Batch
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                      Attendance %
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                      Records
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {topByBatch.map((row, i) => (
                    <tr key={i} className="hover:bg-white/60">
                      <td className="px-6 py-3 text-sm text-gray-900">{row.name}</td>
                      <td className="px-6 py-3 text-sm text-gray-900">{row.rate}%</td>
                      <td className="px-6 py-3 text-sm text-gray-600">{row.total}</td>
                    </tr>
                  ))}
                  {topByBatch.length === 0 && (
                    <tr>
                      <td className="px-6 py-4 text-gray-500 text-sm" colSpan={3}>
                        No data
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom Teachers */}
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/50 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">
                Lowest Attendance (Teachers)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50/80">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                      Teacher
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                      Attendance %
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                      Records
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {bottomByTeacher.map((row, i) => (
                    <tr key={i} className="hover:bg-white/60">
                      <td className="px-6 py-3 text-sm text-gray-900">{row.name}</td>
                      <td className="px-6 py-3 text-sm text-gray-900">{row.rate}%</td>
                      <td className="px-6 py-3 text-sm text-gray-600">{row.total}</td>
                    </tr>
                  ))}
                  {bottomByTeacher.length === 0 && (
                    <tr>
                      <td className="px-6 py-4 text-gray-500 text-sm" colSpan={3}>
                        No data
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Empty state if nothing fetched */}
        {attendance.length === 0 && !loading && !err && (
          <div className="mt-8 text-center text-gray-500">
            Tip: choose filters and click <span className="font-semibold">Fetch Report</span>.
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;
