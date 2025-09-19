// Frontend/src/components/AddBatchForm.jsx
import React, { useState } from "react";
import axios from "axios";
import { API_BASE } from "../config/api";

const BATCH_TYPES = ["Ammar", "Miqdaad", "Bilal", "Abuzar", "Salman"];

const AddBatchForm = ({ token, setBatches }) => {
  const [name, setName] = useState("");
  const [batchType, setBatchType] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const authHeaders = { Authorization: `Bearer ${token}` };

  const reset = () => {
    setName("");
    setBatchType("");
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Batch name is required");
      return;
    }

    setSubmitting(true);
    try {
      // Create batch (include batchType)
      await axios.post(
        `${API_BASE}/teacher/batches`,
        { name: name.trim(), batchType: batchType || undefined },
        { headers: authHeaders }
      );

      // Refresh list: call teacher/batches endpoint (same one used by dashboard)
      const res = await axios.get(`${API_BASE}/teacher/batches`, { headers: authHeaders });
      const list = Array.isArray(res.data) ? res.data : [];
      setBatches(list);

      reset();
      // Small success feedback
      const n = document.createElement("div");
      n.innerText = "Batch created";
      n.className = "fixed bottom-6 right-6 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg";
      document.body.appendChild(n);
      setTimeout(() => n.remove(), 1600);
    } catch (err) {
      console.error("Create batch error:", err);
      setError(err?.response?.data?.message || "Failed to create batch");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleCreate} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">Batch name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Ammar_mumbra_batch_1"
            className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white/90 focus:ring-2 focus:ring-blue-100 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Batch type</label>
          <select
            value={batchType}
            onChange={(e) => setBatchType(e.target.value)}
            className="w-full px-3 py-3 rounded-2xl border border-gray-200 bg-white/90 focus:ring-2 focus:ring-indigo-100 outline-none"
          >
            <option value="">Select batch type </option>
            {BATCH_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-400 mt-1">Selecting a type helps with subject allocation later</p>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => { setName(""); setBatchType(""); }}
          className="px-4 py-2 rounded-xl border border-gray-200 bg-white hover:shadow-sm"
          disabled={submitting}
        >
          Clear
        </button>

        <button
          type="submit"
          className="px-5 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-2xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-150 disabled:opacity-60"
          disabled={submitting}
        >
          {submitting ? "Creating..." : "Create Batch"}
        </button>
      </div>
    </form>
  );
};

export default AddBatchForm;
