import React, { useEffect, useState } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";
import { API_BASE } from "../config/api";

const STATUS_OPTIONS = ["Present", "Absent"];
// const API_BASE = "http://localhost:5000/api/teacher";

const TeacherAttendance = () => {
  const { batchId } = useParams();
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [remarks, setRemarks] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [attendanceExists, setAttendanceExists] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => {
    // default: today as YYYY-MM-DD for input[type=date]
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });

  const token = localStorage.getItem("token");

  const formatDateForAPI = (yyyyMmDd) => {
    // Ensure date-only ISO (server can interpret as that date)
    return yyyyMmDd; // e.g., '2025-08-24'
  };

  const initDefaultsForStudents = (list) => {
    const initialAttendance = {};
    const initialRemarks = {};
    list.forEach((s) => {
      initialAttendance[s._id] = "Present";
      initialRemarks[s._id] = "";
    });
    setAttendance(initialAttendance);
    setRemarks(initialRemarks);
  };

  const fetchStudents = async () => {
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const res = await axios.get(`${API_BASE}/teacher/batches/${batchId}/students`, {
        headers,
      });
      const list = res.data || [];
      setStudents(list);
      initDefaultsForStudents(list);
    } catch (err) {
      console.error(err);
      setStudents([]);
      initDefaultsForStudents([]);
    }
  };

  const fetchAttendanceForDate = async () => {
    const headers = { Authorization: `Bearer ${token}` };
    const dateParam = formatDateForAPI(selectedDate);

    try {
      // Prefer a by-date endpoint if available
      const byDateUrl = `${API_BASE}/teacher/attendance/by-date/${batchId}?date=${encodeURIComponent(
        dateParam
      )}`;
      let attRes;

      try {
        attRes = await axios.get(byDateUrl, { headers });
      } catch (innerErr) {
        // Fallback to your existing "today" endpoint for backwards compatibility
        if (innerErr?.response?.status === 404) {
          attRes = await axios.get(`${API_BASE}/teacher/attendance/today/${batchId}`, {
            headers,
          });
        } else {
          throw innerErr;
        }
      }

      const data = attRes?.data || [];
      // If records exist for the date, hydrate UI with them
      if (Array.isArray(data) && data.length > 0) {
        setAttendanceExists(true);
        const nextAttendance = { ...attendance };
        const nextRemarks = { ...remarks };
        data.forEach((record) => {
          const sid = record.student?._id || record.student; // supports populated or raw id
          if (sid) {
            nextAttendance[sid] = record.status || "Present";
            nextRemarks[sid] = record.remarks || "";
          }
        });
        setAttendance(nextAttendance);
        setRemarks(nextRemarks);
      } else {
        // No attendance yet for this date
        setAttendanceExists(false);
        setEditMode(false);
      }
    } catch (err) {
      console.error(err);
      setAttendanceExists(false);
      setEditMode(false);
    }
  };

  // Initial load
  useEffect(() => {
    if (!batchId) return;
    setLoading(true);
    (async () => {
      await fetchStudents();
      await fetchAttendanceForDate();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId]);

  // Re-fetch when date changes
  useEffect(() => {
    if (!batchId) return;
    setLoading(true);
    (async () => {
      // Reset defaults for current student list before hydrating with fetched records
      initDefaultsForStudents(students);
      await fetchAttendanceForDate();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const handleSubmit = async () => {
    const records = students.map((s) => ({
      studentId: s._id,
      status: attendance[s._id],
      remarks: remarks[s._id] || "",
    }));

    setSubmitting(true);
    try {
      // Include date in payload so server can save for that specific day
      await axios.post(
        `${API_BASE}/teacher/attendance`,
        { batchId, date: formatDateForAPI(selectedDate), records },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert("Attendance saved ✅");
      setAttendanceExists(true);
      setEditMode(false);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to save attendance");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        <div className="w-12 h-12 border-4 border-t-transparent border-blue-500 rounded-full animate-spin"></div>
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 px-6 py-8">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/50 p-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-4">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Mark Attendance
              </h1>
              <p className="text-gray-600 mt-1">Choose a date and record statuses</p>
            </div>

            {/* Date Filter */}
            <div className="flex flex-col">
              <label className="text-sm font-semibold text-gray-700 mb-2">
                <span className="inline-flex items-center">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 mr-2" />
                  Select Date
                </span>
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-4 py-3 bg-white/80 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 outline-none"
              />
            </div>
          </div>

          {/* Edit Button */}
          {attendanceExists && !editMode && (
            <button
              onClick={() => setEditMode(true)}
              className="mb-6 px-6 py-3 rounded-xl text-white font-semibold bg-gradient-to-r from-blue-500 to-indigo-500 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
            >
              Edit Attendance for {new Date(selectedDate).toLocaleDateString()}
            </button>
          )}

          {students.length === 0 ? (
            <div className="text-center text-gray-700 py-10">
              <span className="text-4xl mb-3">📊</span>
              <p>No students in this batch.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {students.map((student) => (
                <div
                  key={student._id}
                  className="
      bg-white/70 backdrop-blur-sm rounded-2xl shadow-md border border-white/50 p-4
      hover:shadow-xl transition-all duration-300
      flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4
    "
                >
                  {/* Name */}
                  <span
                    className="
        font-semibold text-gray-800
        w-full sm:w-48 shrink-0
        truncate
      "
                    title={student.name}
                  >
                    {student.name}
                  </span>

                  {/* Select */}
                  <select
                    value={attendance[student._id] || "Present"}
                    onChange={(e) =>
                      setAttendance({
                        ...attendance,
                        [student._id]: e.target.value,
                      })
                    }
                    className="
        w-full sm:w-44
        px-4 py-3 bg-white/80 border-2 border-gray-200 rounded-xl
        focus:ring-4 focus:ring-blue-100 disabled:opacity-60
        min-w-0
      "
                    disabled={attendanceExists && !editMode}
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>

                  {/* Remarks */}
                  <input
                    type="text"
                    placeholder="Remarks (optional)"
                    value={remarks[student._id] || ""}
                    onChange={(e) =>
                      setRemarks({ ...remarks, [student._id]: e.target.value })
                    }
                    className="
        w-full sm:flex-1
        px-4 py-3 bg-white/80 border-2 border-gray-200 rounded-xl
        focus:ring-4 focus:ring-blue-100 disabled:opacity-60
        min-w-0
      "
                    disabled={attendanceExists && !editMode}
                  />
                </div>
              ))}


              <button
                onClick={handleSubmit}
                disabled={submitting || (attendanceExists && !editMode)}
                className={`mt-6 w-full px-6 py-3 rounded-xl font-semibold text-white transition-all duration-200 transform ${submitting || (attendanceExists && !editMode)
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-emerald-500 to-green-500 shadow-lg hover:shadow-xl hover:scale-105"
                  }`}
              >
                {attendanceExists
                  ? editMode
                    ? `Update Attendance (${new Date(selectedDate).toLocaleDateString()})`
                    : "Attendance Exists"
                  : submitting
                    ? "Submitting..."
                    : `Submit Attendance (${new Date(selectedDate).toLocaleDateString()})`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeacherAttendance;
