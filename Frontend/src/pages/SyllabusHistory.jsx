import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";
import { API_BASE } from "../config/api.js";
import { Filter, Download, Calendar, ChevronDown, ChevronUp } from "lucide-react";

const toLocalYMD = (d) => {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const fmtMonthYear = (isoOrDate) => {
  if (!isoOrDate) return "Unknown";
  const dt = new Date(isoOrDate);
  return dt.toLocaleString(undefined, { month: "long", year: "numeric" });
};

const fmtDayLabel = (isoOrDate) => {
  if (!isoOrDate) return "Unknown";
  const dt = new Date(isoOrDate);
  return dt.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const periodToRange = (token) => {
  if (!token) return {};
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let start = new Date(end);
  if (token === "3m") start.setMonth(start.getMonth() - 3);
  else if (token === "6m") start.setMonth(start.getMonth() - 6);
  else return {};
  return { startDate: toLocalYMD(start), endDate: toLocalYMD(end) };
};

const normalizeResponseToSyllabi = (data) => {
  if (!data) return [];
  if (Array.isArray(data.syllabi)) return data.syllabi;
  if (Array.isArray(data)) return data;
  if (data.syllabus && typeof data.syllabus === "object") return [data.syllabus];
  if (data.entries && Array.isArray(data.entries)) return [data];
  return [];
};

const groupSyllabi = (syllabi) => {
  const grouped = {};
  for (const s of syllabi) {
    const dateIso = s.date ?? s.createdAt ?? s._id ?? null;
    const monthKey = fmtMonthYear(dateIso);
    const dayKey = fmtDayLabel(dateIso);

    if (!grouped[monthKey]) grouped[monthKey] = {};
    if (!grouped[monthKey][dayKey])
      grouped[monthKey][dayKey] = { dateIso, rows: [] };

    const entries = Array.isArray(s.entries) ? s.entries : [];
    for (const e of entries) {
      grouped[monthKey][dayKey].rows.push({
        subject: e.subject ?? e.title ?? "—",
        chapter: e.chapter ?? e.chapterTitle ?? "—",
        remark:
          e.remark ?? e.remarks ?? e.note ?? e.description ?? "—",
        updatedBy:
          (s.createdBy &&
            (typeof s.createdBy === "object"
              ? s.createdBy.name
              : s.createdBy)) ?? "—",
        updatedAt: s.date ?? s.createdAt ?? null,
      });
    }
  }
  return grouped;
};

const SyllabusHistory = () => {
  const { batchId } = useParams();
  const [loading, setLoading] = useState(true);
  const [rawResponse, setRawResponse] = useState(null);
  const [syllabi, setSyllabi] = useState([]);
  const [error, setError] = useState("");

  const [period, setPeriod] = useState("");
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [month, setMonth] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Add state for collapsible months
//   const [expandedMonths, setExpandedMonths] = useState({});

  const token = localStorage.getItem("token");

  const buildParams = () => {
    let sd = startDate?.trim() ? toLocalYMD(startDate) : "";
    let ed = endDate?.trim() ? toLocalYMD(endDate) : "";

    if (!sd && !ed && period) {
      const rng = periodToRange(period);
      sd = rng.startDate || sd;
      ed = rng.endDate || ed;
    }

    const params = {};
    if (sd) params.startDate = sd;
    if (ed) params.endDate = ed;

    if (!sd && !ed) {
      const y = typeof year === "string" ? year.trim() : year;
      if (y && /^\d{4}$/.test(String(y))) params.year = String(y);
      if (month !== "" && !Number.isNaN(Number(month))) {
        const m = Number(month);
        if (m >= 1 && m <= 12) params.month = String(m);
      }
    }
    params._ = String(Date.now());
    return params;
  };

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      if (!batchId) {
        setError("Invalid batch id");
        setLoading(false);
        return;
      }
      const params = buildParams();
      const res = await axios.get(
        `${API_BASE}/teacher/batches/${batchId}/syllabus`,
        {
          params,
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setRawResponse(res.data);
      const normalized = normalizeResponseToSyllabi(res.data);
      setSyllabi(normalized);
      if (!normalized.length)
        setError("No syllabus records found for selected filters.");
    } catch (err) {
      console.error("Syllabus fetch error:", err);
      setError(
        err?.response?.data?.message ||
          err.message ||
          "Failed to fetch"
      );
      setSyllabi([]);
      setRawResponse(err?.response?.data ?? null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId]);

  const grouped = useMemo(() => groupSyllabi(syllabi), [syllabi]);

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const role = (user?.role || user?.type || "teacher").toLowerCase();

  const handleExportSyllabus = async () => {
    if (role !== "teacher") {
      alert("Only Teacher can export syllabus.");
      return;
    }
    if (!!period) {
      alert("Please clear Quick Range to export by month/year.");
      return;
    }
    if (!year || !/^\d{4}$/.test(String(year))) {
      alert("Please enter a valid year (YYYY).");
      return;
    }
    if (!month || Number.isNaN(Number(month))) {
      alert("Please select a month to export.");
      return;
    }

    try {
      const res = await axios.get(`${API_BASE}/reports/syllabus/export`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { batchId, month: String(Number(month)), year: String(year) },
        responseType: "blob",
      });

      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `syllabus_${year}_${String(Number(month)).padStart(
        2,
        "0"
      )}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
      alert(err?.response?.data?.message || "Data not found");
    }
  };

  

  return (
    <div className="min-h-screen pt-10 p-4 md:p-6 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <h1 className="text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Syllabus History
          </h1>
          <p className="text-gray-500 mt-1 md:mt-2 text-sm md:text-base">
            Track syllabus records grouped by month & date
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-md p-4 md:p-6 mb-6 md:mb-8 border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 md:gap-6">
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quick Range
              </label>
              <div className="relative">
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                >
                  <option value="">None</option>
                  <option value="3m">Last 3 months</option>
                  <option value="6m">Last 6 months</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                  <ChevronDown size={16} />
                </div>
              </div>
            </div>

            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Year
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  disabled={!!period}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  min="2000"
                  max="2100"
                />
              </div>
            </div>

            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Month
              </label>
              <div className="relative">
                <select
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  disabled={!!period}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 appearance-none"
                >
                  <option value="">All Months</option>
                  {[...Array(12)].map((_, i) => (
                    <option key={i} value={i + 1}>
                      {new Date(0, i).toLocaleString(undefined, {
                        month: "long",
                      })}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                  <ChevronDown size={16} />
                </div>
              </div>
            </div>

            <div className="md:col-span-2 flex flex-col md:flex-row items-stretch md:items-end gap-3">
              <button
                onClick={fetchData}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium rounded-lg shadow-md hover:from-blue-600 hover:to-indigo-700 active:scale-95 transition-all"
              >
                <Filter size={18} />
                Apply Filters
              </button>
              {role === "teacher" && (
                <button
                  onClick={handleExportSyllabus}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium rounded-lg shadow-md hover:from-green-600 hover:to-emerald-700 active:scale-95 transition-all"
                >
                  <Download size={18} />
                  <span className="hidden sm:inline">Export Excel</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="bg-white rounded-xl shadow-md p-8 md:p-10 text-center border border-gray-200">
            <div className="text-gray-500">Loading syllabus history...</div>
          </div>
        ) : error ? (
          <div className="bg-white rounded-xl shadow-md p-8 md:p-10 text-center border border-gray-200">
            <div className="text-red-600">{error}</div>
          </div>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-8 md:p-10 text-center border border-gray-200">
            <div className="text-gray-500">No records to show.</div>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.keys(grouped).map((monthKey) => (
              <div
                key={monthKey}
                className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200"
              >
                {/* Month Header */}
                <button
                  
                  className="w-full bg-gradient-to-r from-gray-100 to-gray-50 px-4 md:px-6 py-3 border-b border-gray-200 flex justify-between items-center hover:bg-gray-50 transition-colors"
                >
                  <h3 className="text-base md:text-lg font-semibold text-gray-800">
                    {monthKey}
                  </h3>
                  <span className="text-xs font-medium text-gray-600 bg-gray-200 px-2 py-1 rounded-full">
                    {Object.keys(grouped[monthKey]).length} days
                  </span>
                </button>

                {(
                  <div className="divide-y divide-gray-200">
                    {Object.keys(grouped[monthKey]).map((dayKey) => {
                      const dayBlock = grouped[monthKey][dayKey];
                      return (
                        <div key={dayKey} className="p-4 md:p-6">
                          {/* Day Header */}
                          <div className="flex justify-between items-center mb-3 md:mb-4">
                            <h4 className="font-semibold text-gray-800 text-sm md:text-base">
                              {dayKey}
                            </h4>
                            <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded-full">
                              {dayBlock.rows.length} entries
                            </span>
                          </div>

                          {/* Table */}
                          <div className="overflow-x-auto rounded-lg border border-gray-200">
                            <table className="w-full border-collapse">
                              <thead>
                                <tr className="bg-gray-50 text-left text-xs md:text-sm text-gray-600">
                                  <th className="px-3 md:px-4 py-2 md:py-3 font-semibold">
                                    Subject
                                  </th>
                                  <th className="px-3 md:px-4 py-2 md:py-3 font-semibold">
                                    Chapter
                                  </th>
                                  <th className="px-3 md:px-4 py-2 md:py-3 font-semibold">
                                    Remark
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {dayBlock.rows.map((r, idx) => (
                                  <tr
                                    key={idx}
                                    className={
                                      idx % 2 === 0
                                        ? "bg-white"
                                        : "bg-gray-50 hover:bg-gray-100"
                                    }
                                  >
                                    <td className="px-3 md:px-4 py-2 md:py-3 text-xs md:text-sm text-gray-900 font-medium">
                                      {r.subject}
                                    </td>
                                    <td className="px-3 md:px-4 py-2 md:py-3 text-xs md:text-sm text-gray-700">
                                      {r.chapter}
                                    </td>
                                    <td className="px-3 md:px-4 py-2 md:py-3 text-xs md:text-sm text-gray-700">
                                      {r.remark}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SyllabusHistory;