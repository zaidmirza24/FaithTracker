import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../config/api";

const CreateTeacherForm = () => {
  const [form, setForm] = useState({ name: "", email: "", password: "", city: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate()
  const token = localStorage.getItem("token");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await axios.post(`${API_BASE}/admin/teachers`, form, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert("✅ Teacher created successfully");
      setForm({ name: "", email: "", password: "", city: "" });
      navigate("/admin/dashboard")
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create teacher");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 px-6 py-10">
      <div className="max-w-xl mx-auto bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/50 p-8">
        
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-6">
          Create Teacher
        </h1>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-3 bg-white/80 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-4 py-3 bg-white/80 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full px-4 py-3 bg-white/80 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">City</label>
            <input
              type="text"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="w-full px-4 py-3 bg-white/80 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 outline-none"
            />
          </div>

          <button
          // onClick={()=>{navigate("/admin/dashboard")}}
            type="submit"
            disabled={loading}
            className={`w-full px-6 py-3 rounded-xl font-semibold text-white transition-all duration-200 transform ${
              loading
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-gradient-to-r from-blue-500 to-indigo-500 shadow-lg hover:shadow-xl hover:scale-105"
            }`
            
          }
          >
            {loading ? "Creating..." : "Create Teacher"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateTeacherForm;
