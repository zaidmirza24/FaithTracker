import React, { useEffect, useState } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";
import { API_BASE } from "../config/api";

const STATUS_OPTIONS = ["Present", "Absent"];

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
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });

  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  const formatDateForAPI = (yyyyMmDd) => yyyyMmDd;

  // Merge defaults for a given roster with existing selections
  const mergeStateForRoster = (list, prevAttendance = attendance, prevRemarks = remarks) => {
    const nextAttendance = {};
    const nextRemarks = {};
    list.forEach((s) => {
      nextAttendance[s._id] = prevAttendance[s._id] ?? "Present";
      nextRemarks[s._id] = prevRemarks[s._id] ?? "";
    });
    setAttendance(nextAttendance);
    setRemarks(nextRemarks);
  };

  // Fetch students and merge local state; returns the fresh list
  const getFreshStudents = async () => {
    const res = await axios.get(`${API_BASE}/teacher/batches/${batchId}/students`, { headers });
    const list = res.data || [];
    setStudents(list);
    mergeStateForRoster(list);
    return list;
  };

  const fetchAttendanceForDate = async (roster = students) => {
    const dateParam = formatDateForAPI(selectedDate);

    // Prefer by-date endpoint; fallback to "today"
    const byDateUrl = `${API_BASE}/teacher/attendance/by-date/${batchId}?date=${encodeURIComponent(
      dateParam
    )}`;

    let data = [];
    try {
      const attRes = await axios.get(byDateUrl, { headers });
      data = attRes?.data || [];
    } catch (err) {
      if (err?.response?.status === 404) {
        const fallback = await axios.get(`${API_BASE}/teacher/attendance/today/${batchId}`, {
          headers,
        });
        data = fallback?.data || [];
      } else {
        // If other error, treat as no existing attendance
        data = [];
      }
    }

    if (Array.isArray(data) && data.length > 0) {
      setAttendanceExists(true);
      // hydrate current roster
      const nextAttendance = {};
      const nextRemarks = {};
      roster.forEach((s) => {
        nextAttendance[s._id] = "Present";
        nextRemarks[s._id] = "";
      });

      data.forEach((record) => {
        const sid = record.student?._id || record.student;
        if (sid) {
          nextAttendance[sid] = record.status || "Present";
          nextRemarks[sid] = record.remarks || "";
        }
      });

      setAttendance(nextAttendance);
      setRemarks(nextRemarks);
    } else {
      setAttendanceExists(false);
      setEditMode(false);
      // Ensure defaults aligned with roster
      mergeStateForRoster(roster, {}, {});
    }
  };

  // Initial load
  useEffect(() => {
    if (!batchId) return;
    setLoading(true);
    (async () => {
      try {
        const list = await getFreshStudents();
        await fetchAttendanceForDate(list);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId]);

  // Re-fetch when date changes (keep current roster, rehydrate statuses)
  useEffect(() => {
    if (!batchId) return;
    setLoading(true);
    (async () => {
      try {
        // Reset defaults for current roster then hydrate from server for that date
        mergeStateForRoster(students, {}, {});
        await fetchAttendanceForDate(students);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  // Refetch roster when tab regains focus (covers delete→add on other screens)
  useEffect(() => {
    const onFocus = async () => {
      if (!batchId) return;
      try {
        const list = await getFreshStudents();
        await fetchAttendanceForDate(list);
      } catch (e) {
        // noop
      }
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [batchId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const list = await getFreshStudents();
      await fetchAttendanceForDate(list);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // Guarantee we submit with the latest roster
      const freshList = await getFreshStudents();

      const records = freshList.map((s) => ({
        studentId: s._id,
        status: attendance[s._id] || "Present",
        remarks: remarks[s._id] || "",
      }));

      await axios.post(
        `${API_BASE}/teacher/attendance`,
        { batchId, date: formatDateForAPI(selectedDate), records },
        { headers }
      );

      alert("Attendance saved ✅");
      setAttendanceExists(true);
      setEditMode(false);
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to save attendance");
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

            {/* Right-side controls */}
            <div className="flex items-end gap-3">
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

              <button
                onClick={handleRefresh}
                className="h-[46px] px-4 py-3 rounded-xl font-semibold bg-slate-200 hover:bg-slate-300 text-slate-800 shadow"
                title="Refetch latest students and attendance"
              >
                Refresh
              </button>
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
                  className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-md border border-white/50 p-4 hover:shadow-xl transition-all duration-300 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4"
                >
                  {/* Name */}
                  <span
                    className="font-semibold text-gray-800 w-full sm:w-48 shrink-0 truncate"
                    title={student.name}
                  >
                    {student.name}
                  </span>

                  {/* Select */}
                  <select
                    value={attendance[student._id] ?? "Present"}
                    onChange={(e) =>
                      setAttendance((prev) => ({
                        ...prev,
                        [student._id]: e.target.value,
                      }))
                    }
                    className="w-full sm:w-44 px-4 py-3 bg-white/80 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 disabled:opacity-60 min-w-0"
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
                    value={remarks[student._id] ?? ""}
                    onChange={(e) =>
                      setRemarks((prev) => ({
                        ...prev,
                        [student._id]: e.target.value,
                      }))
                    }
                    className="w-full sm:flex-1 px-4 py-3 bg-white/80 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 disabled:opacity-60 min-w-0"
                    disabled={attendanceExists && !editMode}
                  />
                </div>
              ))}

              <button
                onClick={handleSubmit}
                disabled={submitting || (attendanceExists && !editMode)}
                className={`mt-6 w-full px-6 py-3 rounded-xl font-semibold text-white transition-all duration-200 transform ${
                  submitting || (attendanceExists && !editMode)
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
