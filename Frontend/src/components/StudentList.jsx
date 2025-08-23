import React, { useEffect, useState } from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import AddStudent from "./AddStudent";
import {API_BASE} from "../config/api.js"

const StudentList = () => {
  const { batchId } = useParams();
  const navigate = useNavigate();

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingStudent, setEditingStudent] = useState(null);
  const [newName, setNewName] = useState("");

  const token = localStorage.getItem("token");
  // const API_BASE = "http://localhost:5000/api/teacher";

  const fetchStudents = async () => {
    if (!batchId) return;
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/teacher/batches/${batchId}/students`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStudents(response.data || []);
      setError("");
    } catch (err) {
      if (err.response?.status === 404) {
        setStudents([]);
        setError("");
      } else {
        setStudents([]);
        setError(err.response?.data?.message || "Failed to fetch students");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [batchId]);

  const handleDelete = async (studentId) => {
    if (!window.confirm("Are you sure you want to delete this student?")) return;
    try {
      await axios.delete(`${API_BASE}/teacher/students/${studentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchStudents();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete student");
    }
  };

  const handleEdit = (student) => {
    setEditingStudent(student);
    setNewName(student.name);
  };

  const handleUpdate = async () => {
    try {
      await axios.put(
        `${API_BASE}/teacher/students/${editingStudent._id}`,
        { name: newName },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setEditingStudent(null);
      fetchStudents();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update student");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[40vh]">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return <p className="text-red-500 text-center mt-10">{error}</p>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-8">
      <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-6">
        Students in Batch
      </h1>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-4 mb-6">
        <button
          onClick={() => navigate(`/teacher/batches/${batchId}/attendance`)}
          className="px-5 py-3 rounded-xl shadow-lg bg-gradient-to-r from-emerald-500 to-green-500 text-white font-semibold hover:scale-105 transition-all duration-200"
        >
          Mark Attendance
        </button>

        <button
          onClick={() => navigate(`/teacher/batch/${batchId}/attendance-history`)}
          className="px-5 py-3 rounded-xl shadow-lg bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold hover:scale-105 transition-all duration-200"
        >
          View Attendance History
        </button>
      </div>

      {/* Add Student Form */}
      <div className="mb-6">
        <AddStudent batchId={batchId} onStudentAdded={fetchStudents} />
      </div>

      {/* Student List */}
      {students.length === 0 ? (
        <div className="bg-white/70 backdrop-blur-sm border border-white/50 rounded-2xl shadow-lg p-6 text-center">
          <p className="text-gray-600">No students found in this batch. Add a new student above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {students.map((student) => (
            <div
              key={student._id}
              className="bg-white/70 backdrop-blur-sm border border-white/50 rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300"
            >
              {editingStudent?._id === student._id ? (
                <>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-4 py-3 mb-3 bg-white/80 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 outline-none"
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={handleUpdate}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold hover:scale-105 transition-all"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingStudent(null)}
                      className="px-4 py-2 rounded-xl bg-gray-400 text-white font-semibold hover:scale-105 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-lg font-semibold text-gray-800">{student.name}</h2>
                  <div className="mt-4 flex gap-3">
                    <button
                      onClick={() => handleEdit(student)}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 text-white font-semibold hover:scale-105 transition-all"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(student._id)}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-500 to-pink-500 text-white font-semibold hover:scale-105 transition-all"
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StudentList;
