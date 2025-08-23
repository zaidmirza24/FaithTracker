import React, { useEffect, useState } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";
import { API_BASE } from "../config/api";

const BatchDetails = () => {
  const { batchId } = useParams();
  const token = localStorage.getItem("token");

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newStudent, setNewStudent] = useState({ name: "", email: "" });
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const response = await axios.get(
          `${API_BASE}/teacher/batches/${batchId}/students`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setStudents(response.data);
        setLoading(false);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to fetch students");
        setLoading(false);
      }
    };

    fetchStudents();
  }, [batchId, token]);

  const handleAddStudent = async (e) => {
    e.preventDefault();
    if (!newStudent.name || !newStudent.email) return;

    setAdding(true);
    try {
      const response = await axios.post(
        `${API_BASE}/teacher/batches/${batchId}/students`,
        { students: [newStudent] },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStudents([...students, ...response.data]);
      setNewStudent({ name: "", email: "" });
    } catch (err) {
      alert(err.response?.data?.message || "Failed to add student");
    }
    setAdding(false);
  };

  if (loading) return <p className="mt-10 text-center">Loading students...</p>;
  if (error) return <p className="text-red-500 mt-10 text-center">{error}</p>;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Batch Details</h1>

      <h2 className="text-xl font-semibold mb-2">Add New Student</h2>
      <form className="mb-6 flex gap-2" onSubmit={handleAddStudent}>
        <input
          type="text"
          placeholder="Name"
          className="border p-2 rounded flex-1"
          value={newStudent.name}
          onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
        />
        <input
          type="email"
          placeholder="Email"
          className="border p-2 rounded flex-1"
          value={newStudent.email}
          onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
        />
        <button
          type="submit"
          disabled={adding}
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
        >
          {adding ? "Adding..." : "Add"}
        </button>
      </form>

      <h2 className="text-xl font-semibold mb-2">Students</h2>
      {students.length === 0 ? (
        <p>No students yet.</p>
      ) : (
        <ul className="border rounded p-4">
          {students.map((student) => (
            <li key={student._id} className="border-b py-2">
              {student.name} - {student.email}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default BatchDetails;
