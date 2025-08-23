import React, { useState } from "react";
import axios from "axios";
import {API_BASE} from "../config/api.js"

const AddStudent = ({ batchId, onStudentAdded }) => {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const token = localStorage.getItem("token");
  // const BASE = "http://localhost:5000/api/teacher";

  // Normalize a name for comparison (trim + collapse spaces + lowercase)
  const normalize = (s = "") =>
    s.trim().replace(/\s+/g, " ").toLowerCase();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const inputName = normalize(name);
    if (!inputName) {
      setError("Student name is required");
      return;
    }

    setLoading(true);
    try {
      // 1) Fetch existing students in this batch (front-end duplicate check)
      const listRes = await axios.get(`${API_BASE}/teacher/batches/${batchId}/students`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const existing = (listRes.data || []).map(s => normalize(s.name));

      if (existing.includes(inputName)) {
        setError("This student already exists in this batch.");
        setLoading(false);
        return;
      }

      // 2) Not a duplicate -> proceed to add
      const prettyName = name.trim().replace(/\s+/g, " ");
      const response = await axios.post(
        `${API_BASE}/teacher/batches/${batchId}/students`,
        { students: [{ name: prettyName }] },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      onStudentAdded(response.data);
      setName(""); // clear input
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add student");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/50 p-6 hover:shadow-xl transition-all duration-300"
    >
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          Add New Student
        </h2>
        <p className="text-gray-600 mt-1">Create a student for this batch</p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 rounded-xl border border-red-200 bg-red-50 text-red-800">
          <div className="flex items-center">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 mr-2" />
            {error}
          </div>
        </div>
      )}

      {/* Input */}
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        <span className="inline-flex items-center">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 mr-2" />
          Student Name
        </span>
      </label>
      <input
        type="text"
        placeholder="e.g., Ayaan Khan"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full px-4 py-3 bg-white/80 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all duration-200"
        required
      />

      {/* Actions */}
      <div className="mt-4">
        <button
          type="submit"
          disabled={loading}
          className={`w-full px-6 py-3 rounded-xl text-white font-semibold shadow-lg transition-all duration-200 transform
            ${loading
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-gradient-to-r from-emerald-500 to-green-500 hover:shadow-xl hover:scale-105"}
          `}
        >
          {loading ? (
            <span className="inline-flex items-center">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Adding...
            </span>
          ) : (
            "Add Student"
          )}
        </button>
      </div>
    </form>
  );
};

export default AddStudent;
