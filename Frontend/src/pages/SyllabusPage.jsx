
// Frontend/src/pages/SyllabusPage.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getSyllabus, saveSyllabus } from "../services/syllabusService";
import { API_BASE } from "../config/api"; // optional
import dayjs from "dayjs";
import { ArrowLeft, Save, Trash2 } from "lucide-react";

const SyllabusRow = ({ item, onChange }) => {
  // item: { subject, chapter, remark, chapters (array) }
  return (
    <div className="flex flex-col md:flex-row gap-4 items-start md:items-center py-4 border-b border-gray-200/50 last:border-b-0">
      <div className="w-full md:w-1/4 font-medium text-gray-900">{item.subject}</div>
      <div className="w-full md:w-1/3">
        <select
          value={item.chapter || ""}
          onChange={(e) => onChange({ ...item, chapter: e.target.value })}
          className="w-full border border-gray-300 p-3 rounded-xl bg-white/80 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
        >
          <option value="">-- Select chapter --</option>
          {(item.chapters || []).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div className="flex-1 w-full">
        <input
          value={item.remark || ""}
          onChange={(e) => onChange({ ...item, remark: e.target.value })}
          className="w-full border border-gray-300 p-3 rounded-xl bg-white/80 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
          placeholder="Remark (optional)"
        />
      </div>
    </div>
  );
};

const SyllabusPage = () => {
  const { batchId } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [batch, setBatch] = useState(null);
  const [rows, setRows] = useState([]); // {subject, chapters: [], chapter, remark}
  const [error, setError] = useState("");

  useEffect(() => {
    if (!batchId) return;
    fetchSyllabus(date);
    // eslint-disable-next-line
  }, [batchId]);

  const fetchSyllabus = async (d) => {
    setLoading(true);
    setError("");
    try {
      const res = await getSyllabus(batchId, d, token);
      // res: { batch, date, syllabus }
      setBatch(res.batch || null);
      // build default rows from batch.subjects
      const subjects = (res.batch?.subjects || []).map((s) => ({
        subject: s.name,
        chapters: s.chapters || [],
        chapter: "",
        remark: "",
      }));

      if (res.syllabus && res.syllabus.entries && res.syllabus.entries.length) {
        // map entries to subjects
        const map = {};
        res.syllabus.entries.forEach((e) => (map[e.subject] = e));
        const merged = subjects.map((s) => ({
          ...s,
          chapter: map[s.subject]?.chapter || "",
          remark: map[s.subject]?.remark || "",
        }));
        setRows(merged);
      } else {
        setRows(subjects);
      }
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || "Failed to load syllabus");
    } finally {
      setLoading(false);
    }
  };

  const handleRowChange = (index, newRow) => {
    const copy = [...rows];
    copy[index] = newRow;
    setRows(copy);
  };

  const handleSave = async () => {
    setError("");
    try {
      // filter rows to entries (subject must have a chapter selected)
      const entries = rows
        .filter((r) => r.chapter && r.chapter.trim() !== "")
        .map((r) => ({ subject: r.subject, chapter: r.chapter, remark: r.remark || "" }));
      await saveSyllabus(batchId, date, entries, token);
      alert("Syllabus saved successfully!");
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || "Failed to save");
    }
  };

  return (
    <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Update Syllabus</h2>
          <div>
            <button 
              onClick={() => navigate(-1)} 
              className="inline-flex items-center gap-2 px-4 py-3 rounded-xl text-white font-semibold bg-gradient-to-r from-blue-500 to-indigo-500 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          </div>
        </div>

        {loading ? (
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/50 p-8 text-center">
            <div className="text-lg text-gray-600">Loading syllabus data...</div>
          </div>
        ) : (
          <>
            {batch && (
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/50 p-6 mb-6">
                <div className="text-xl font-bold text-gray-900">{batch.name}</div>
                <div className="text-sm text-gray-600 mt-2">City: {batch.city}</div>
              </div>
            )}

            <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/50 p-6 mb-6">
              <div className="flex flex-col md:flex-row gap-3 items-center">
                <label className="font-medium text-gray-700">Date:</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => {
                    const d = e.target.value;
                    setDate(d);
                    fetchSyllabus(d);
                  }}
                  className="border border-gray-300 p-3 rounded-xl bg-white/80 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-100/70 border border-red-200 text-red-700 p-4 rounded-2xl mb-6">
                {error}
              </div>
            )}

            <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/50 p-6 mb-6">
              {rows.length === 0 ? (
                <div className="text-center text-gray-600 py-8">
                  No subjects found for this batch. Add subjects in admin panel.
                </div>
              ) : (
                <div className="divide-y divide-gray-200/50">
                  <div className="hidden md:flex flex-col md:flex-row gap-4 items-start md:items-center py-3 font-semibold text-gray-700 mb-2">
                    <div className="w-full md:w-1/4">Subject</div>
                    <div className="w-full md:w-1/3">Chapter</div>
                    <div className="flex-1 w-full">Remarks</div>
                  </div>
                  {rows.map((r, idx) => (
                    <SyllabusRow key={r.subject + idx} item={r} onChange={(nr) => handleRowChange(idx, nr)} />
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <button 
                onClick={handleSave} 
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold bg-gradient-to-r from-blue-500 to-indigo-500 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
              >
                <Save className="w-4 h-4" />
                Save Syllabus
              </button>
              <button 
                onClick={() => { setRows(rows.map(r => ({...r, chapter: "", remark: ""}))) }} 
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold bg-gradient-to-r from-red-500 to-pink-500 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
              >
                <Trash2 className="w-4 h-4" />
                Clear All
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SyllabusPage;