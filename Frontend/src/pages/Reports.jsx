// src/pages/Reports.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import { API_BASE } from "../config/api";

const Reports = () => {
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const role = (user?.role || user?.type || "teacher").toLowerCase();

  const authHeaders = { Authorization: `Bearer ${token}` };

  // Admin pickers
  const [cities, setCities] = useState([]);
  const [selectedCity, setSelectedCity] = useState("");
  const [teachers, setTeachers] = useState([]);
  const [selectedTeacher, setSelectedTeacher] = useState("");

  // Common
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState("");

  // ✅ Add-on quick range ("" | "3m" | "6m")
  const [period, setPeriod] = useState("");

  // Keep your Year/Month as-is (used when period is empty)
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [month, setMonth] = useState(""); // "" = all

  const [attendance, setAttendance] = useState([]);

  const [loadingInit, setLoadingInit] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [error, setError] = useState("");

  // ---------- Init (role-aware) ----------
  useEffect(() => {
    const init = async () => {
      try {
        setError("");
        if (role === "teacher") {
          // Teacher: load own batches
          const res = await axios.get(`${API_BASE}/teacher/batches`, {
            headers: authHeaders,
          });
          const list = Array.isArray(res.data) ? res.data : [];
          setBatches(list);
          setSelectedBatch(list[0]?._id || "");
        } else {
          // Admin: load cities first
          const res = await axios.get(`${API_BASE}/admin/cities`, {
            headers: authHeaders,
          });
          const cityList = Array.isArray(res.data) ? res.data : [];
          setCities(cityList);
          setSelectedCity(cityList[0] || "");
        }
      } catch (err) {
        setError(err?.response?.data?.message || "Failed to load data");
      } finally {
        setLoadingInit(false);
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  // ---------- Admin: load teachers for a city ----------
  useEffect(() => {
    const loadTeachers = async () => {
      if (role === "teacher" || !selectedCity) return;
      try {
        setError("");
        const res = await axios.get(
          `${API_BASE}/admin/cities/${encodeURIComponent(selectedCity)}/teachers`,
          { headers: authHeaders }
        );
        const list = Array.isArray(res.data) ? res.data : [];
        setTeachers(list);
        setSelectedTeacher(list[0]?._id || "");
      } catch (err) {
        setTeachers([]);
        setSelectedTeacher("");
        setError(err?.response?.data?.message || "Failed to fetch teachers");
      }
    };
    loadTeachers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCity, role]);

  // ---------- Admin: load batches for a teacher ----------
  useEffect(() => {
    const loadBatches = async () => {
      if (role === "teacher") return;
      if (!selectedTeacher) {
        setBatches([]);
        setSelectedBatch("");
        return;
      }
      try {
        setLoadingBatches(true);
        setError("");
        const res = await axios.get(
          `${API_BASE}/admin/teachers/${selectedTeacher}/batches`,
          { headers: authHeaders }
        );
        const list = Array.isArray(res.data) ? res.data : [];
        setBatches(list);
        setSelectedBatch(list[0]?._id || "");
      } catch (err) {
        setBatches([]);
        setSelectedBatch("");
        setError(err?.response?.data?.message || "Failed to fetch batches");
      } finally {
        setLoadingBatches(false);
      }
    };
    loadBatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTeacher, role]);

  // ---------- Build params consistently ----------
  const buildParams = () => {
    const params = {};
    if (period) {
      params.period = period; // quick range takes priority
    } else {
      const y = typeof year === "string" ? year.trim() : year;
      if (y && /^\d{4}$/.test(String(y))) params.year = String(y);
      if (month !== "" && !Number.isNaN(Number(month))) {
        const m = Number(month);
        if (m >= 1 && m <= 12) params.month = String(m);
      }
    }
    params._ = Date.now(); // cache buster
    return params;
  };

  // ---------- Fetch attendance (role-aware endpoint) ----------
  const fetchAttendance = async () => {
    if (!selectedBatch) return;
    setLoading(true);
    try {
      const params = buildParams();

      let url;
      if (role === "teacher") {
        url = `${API_BASE}/teacher/attendance/history/${selectedBatch}`;
      } else {
        url = `${API_BASE}/admin/attendance`;
        params.batchId = selectedBatch;
      }

      const res = await axios.get(url, {
        headers: authHeaders,
        params,
      });

      const data = Array.isArray(res.data) ? res.data : [];
      setAttendance(data);
      setError("");
    } catch (err) {
      setAttendance([]);
      setError(err?.response?.data?.message || "Failed to fetch attendance");
    } finally {
      setLoading(false);
    }
  };

  // Auto-refetch when filters change
  useEffect(() => {
    if (!selectedBatch) return;
    const t = setTimeout(fetchAttendance, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBatch, year, month, period, role]);

  // ---------- Build chart data: Present + Absent counts per student ----------
  const chartData = useMemo(() => {
    if (!attendance.length) return [];
    const map = new Map();

    for (const rec of attendance) {
      const name =
        rec?.student?.name ||
        rec?.studentName ||
        rec?.student_name ||
        "Unknown";

      const status = String(rec?.status || "").toLowerCase();
      if (!map.has(name)) map.set(name, { present: 0, absent: 0, total: 0 });

      // Only count Present/Absent toward % so bars sum to 100
      if (status === "present" || status === "absent") {
        const o = map.get(name);
        o.total += 1;
        if (status === "present") o.present += 1;
        else o.absent += 1;
      }
    }

    return Array.from(map.entries()).map(([name, v]) => {
      const total = v.total || 0;
      const presentPct = total ? Math.round((v.present / total) * 100) : 0;
      const absentPct = 100 - presentPct;
      return {
        name,
        presentPct,
        absentPct,
        presentCount: v.present,
        absentCount: v.absent,
        total,
      };
    });
  }, [attendance]);


  // ---------- UI ----------
  if (loadingInit) {
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
              Reports
            </h1>
            <p className="text-gray-600 mt-1">Present vs Absent per student</p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            {role !== "teacher" && (
              <>
                <div className="flex flex-col min-w-[10rem]">
                  <label className="text-sm font-semibold text-gray-700 mb-2">
                    City
                  </label>
                  <select
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    className="px-4 py-3 bg-white/80 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 outline-none"
                  >
                    {cities.length ? (
                      cities.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))
                    ) : (
                      <option value="">No cities</option>
                    )}
                  </select>
                </div>

                <div className="flex flex-col min-w-[12rem]">
                  <label className="text-sm font-semibold text-gray-700 mb-2">
                    Teacher
                  </label>
                  <select
                    value={selectedTeacher}
                    onChange={(e) => setSelectedTeacher(e.target.value)}
                    className="px-4 py-3 bg-white/80 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 outline-none"
                    disabled={!teachers.length}
                  >
                    {teachers.length ? (
                      teachers.map((t) => (
                        <option key={t._id} value={t._id}>
                          {t.name}
                        </option>
                      ))
                    ) : (
                      <option value="">No teachers</option>
                    )}
                  </select>
                </div>
              </>
            )}

            <div className="flex flex-col min-w-[12rem]">
              <label className="text-sm font-semibold text-gray-700 mb-2">
                Batch
              </label>
              <select
                value={selectedBatch}
                onChange={(e) => setSelectedBatch(e.target.value)}
                disabled={loadingBatches || !batches.length}
                className="px-4 py-3 bg-white/80 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 outline-none disabled:opacity-60"
              >
                {loadingBatches ? (
                  <option>Loading...</option>
                ) : batches.length ? (
                  batches.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.name}
                    </option>
                  ))
                ) : (
                  <option value="">No batches</option>
                )}
              </select>
            </div>

            {/* ✅ Quick Range */}
            <div className="flex flex-col w-44">
              <label className="text-sm font-semibold text-gray-700 mb-2">
                Quick Range
              </label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="px-4 py-3 bg-white/80 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-green-100 outline-none"
              >
                <option value="">None</option>
                <option value="3m">Last 3 months</option>
                <option value="6m">Last 6 months</option>
              </select>
            </div>

            {/* Year/Month (disabled when quick range is active) */}
            <div className="flex flex-col w-40">
              <label className="text-sm font-semibold text-gray-700 mb-2">
                Year
              </label>
              <input
                type="number"
                placeholder="2025"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                disabled={!!period}
                className={`px-4 py-3 bg-white/80 border-2 rounded-xl focus:ring-4 focus:ring-blue-100 outline-none ${period ? "opacity-60 cursor-not-allowed" : "border-gray-200"
                  }`}
              />
            </div>

            <div className="flex flex-col w-44">
              <label className="text-sm font-semibold text-gray-700 mb-2">
                Month
              </label>
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                disabled={!!period}
                className={`px-4 py-3 bg-white/80 border-2 rounded-xl focus:ring-4 focus:ring-purple-100 outline-none ${period ? "opacity-60 cursor-not-allowed" : "border-gray-200"
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

            <div className="flex items-end">
              <button
                onClick={fetchAttendance}
                disabled={loading || !selectedBatch}
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? "Loading..." : "Refresh"}
              </button>
            </div>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-800 shadow-lg">
            <div className="flex items-center">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 mr-3" />
              {error}
            </div>
          </div>
        )}

        {/* Chart Card */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/50 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800">
              Present (green) vs Absent (red) — per student
            </h2>
            <div className="text-sm text-gray-600">
              {chartData.length} student{chartData.length !== 1 ? "s" : ""}
            </div>
          </div>

          {!selectedBatch ? (
            <div className="py-16 text-center text-gray-500">
              Select a batch to view the chart.
            </div>
          ) : chartData.length === 0 ? (
            <div className="py-16 text-center text-gray-500">
              <div className="text-6xl mb-3">📊</div>
              No data for the selected filters.
            </div>
          ) : (
            <div className="w-full h-[420px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis
                    dataKey="name"
                    interval={0}
                    angle={-30}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis domain={[0, 100]} tickFormatter={(t) => `${t}%`} />
                  <Tooltip
                    formatter={(value, name) => [`${value}%`, name]}
                    labelFormatter={(_, payload) => {
                      const p = payload?.[0]?.payload;
                      if (!p) return "";
                      return `${p.name} — ${p.presentCount}/${p.total} present (${p.presentPct}%)`;
                    }}
                  />
                  <Legend />
                  {/* side-by-side percentage bars */}
                  <Bar dataKey="presentPct" name="Present %" fill="#10B981" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="absentPct" name="Absent %" fill="#EF4444" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>


            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reports;
