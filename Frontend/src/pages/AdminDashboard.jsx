import React, { useEffect, useState } from "react";
import {API_BASE} from "../config/api.js"
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
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  const token = localStorage.getItem("token");
  // const API_BASE = "http://localhost:5000/api/admin";
  // const REPORTS_API = "http://localhost:5000/api/reports";

  // Fetch cities
  useEffect(() => {
    const fetchCities = async () => {
      try {
        const res = await axios.get(`${API_BASE}/admin/cities`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setCities(res.data || []);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to fetch cities");
      }
    };
    fetchCities();
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
        setTeachers(res.data || []);
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
        setBatches(res.data || []);
        setSelectedBatch("");
        setAttendance([]);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to fetch batches");
      }
    };
    fetchBatches();
  }, [selectedTeacher]);

  // Fetch attendance and summary
  const fetchAttendance = async () => {
    if (!year && !month && selectedBatch) {
      alert("Please select at least a Year or a Month to filter attendance.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      let url = `${API_BASE}/admin/attendance?`;
      if (selectedBatch) url += `batchId=${selectedBatch}`;
      if (year) url += `&year=${year}`;
      if (month) url += `&month=${month}`;

      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAttendance(res.data || []);

      // Summary
      let summaryUrl = `${API_BASE}/reports/summary?`;
      if (selectedBatch) summaryUrl += `batchId=${selectedBatch}`;
      if (year) summaryUrl += `&year=${year}`;
      if (month) summaryUrl += `&month=${month}`;

      const summaryRes = await axios.get(summaryUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSummaryData(summaryRes.data || []);
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
    navigate('/login');
  };

  // Export Excel (unchanged)
  const exportExcel = async () => {
    if (!selectedBatch) return alert("Select a batch first!");

    try {
      let url = `${API_BASE}/reports/export?batchId=${selectedBatch}`;
      if (year) url += `&year=${year}`;
      if (month) url += `&month=${month}`;

      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });

      const contentDisposition =
        res.headers["content-disposition"] || res.headers["Content-Disposition"];
      let filename = "attendance.xlsx";
      if (contentDisposition) {
        let filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
        if (!filenameMatch) filenameMatch = contentDisposition.match(/filename=([^;]+)/);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Navbar / Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Admin Dashboard
            </h1>
            <p className="text-gray-600 mt-1">Manage attendance and generate reports</p>
          </div>

          {/* Nav actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/admin/create-teacher")}
              className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold rounded-xl shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200"
            >
              + Create Teacher
            </button>

            <button
              onClick={() => navigate("/reports")}
              className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-green-500 text-white font-semibold rounded-xl shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200"
            >
              Generate Report
            </button>

            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-gradient-to-r from-red-500 to-pink-500 text-white font-semibold rounded-xl shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* City */}
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-white/50">
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
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-white/50">
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
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Batch */}
          {batches.length > 0 && (
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-white/50">
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
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Filters & Actions */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/50 mb-8">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-32">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Year
              </label>
              <input
                type="number"
                placeholder="2025"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full px-4 py-3 bg-white/80 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-400 transition-all duration-200"
              />
            </div>

            <div className="flex-1 min-w-40">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Month
              </label>
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-full px-4 py-3 bg-white/80 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-400 transition-all duration-200"
              >
                <option value="">All Months</option>
                {[...Array(12)].map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(0, i).toLocaleString("default", { month: "long" })}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <button
                onClick={fetchAttendance}
                disabled={loading}
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {loading ? (
                  <div className="flex items-center">
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
                  className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-500 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
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
                  <span className="text-gray-600 text-lg">Loading attendance data...</span>
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
                  <tbody className="divide-y divide-gray-200">
                    {attendance.map((rec) => (
                      <tr
                        key={rec._id}
                        className="hover:bg-white/50 transition-colors duration-150"
                      >
                        <td className="px-6 py-4 text-sm text-gray-800">
                          {new Date(rec.date).toLocaleDateString("en-US", {
                            weekday: "short",
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {rec.student.name}
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
