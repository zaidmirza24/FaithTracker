import React, { useEffect, useState } from "react";
import { getBatches } from "../services/teacherService";
import AddBatchForm from "../components/AddBatchForm";
import BatchList from "../components/BatchList";
import { BookOpen, Users, TrendingUp, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";

const TeacherDashboard = () => {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user"));
  const navigate = useNavigate();

  useEffect(() => {
    const fetchBatches = async () => {
      try {
        const data = await getBatches(token);
        setBatches(Array.isArray(data) ? data : []);
        setError("");
      } catch (err) {
        if (err?.response?.status === 404) {
          setBatches([]);
          setError("");
        } else {
          setBatches([]);
          setError(err?.response?.data?.message || "Failed to fetch batches");
        }
      } finally {
        setLoading(false);
      }
    };
    fetchBatches();
  }, [token]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/50 p-6 sm:p-8">
          <div className="flex items-center justify-center space-x-3">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
            <p className="text-base sm:text-lg font-medium text-gray-700">Loading batches...</p>
          </div>
        </div>
      </div>
    );
  }

  const ErrorBanner = () =>
    error ? (
      <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-800 shadow-lg">
        <div className="flex items-center">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 mr-3" />
          {error}
        </div>
      </div>
    ) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Header Section */}
        <div className="mb-6 sm:mb-8">
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/50 p-5 sm:p-6 transition-all duration-300 hover:shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-1 sm:mb-2 truncate">
                  Welcome, {user?.name || "Teacher"}
                </h1>
                <p className="text-gray-600 text-sm sm:text-base">
                  Manage your classes and track student progress
                </p>
              </div>

              <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-3">
                {/* Accent Dots */}
                <div className="hidden md:flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-400"></div>
                  <div className="w-3 h-3 rounded-full bg-purple-400"></div>
                  <div className="w-3 h-3 rounded-full bg-green-400"></div>
                </div>

                {/* Logout Button */}
                <button
                  onClick={handleLogout}
                  className="w-full sm:w-auto px-4 py-2 flex items-center justify-center gap-2 bg-gradient-to-r from-red-500 to-pink-500 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>

        <ErrorBanner />

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/50 p-5 sm:p-6 transition-all duration-300 hover:shadow-xl">
            <div className="flex items-center">
              <div className="p-3 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-semibold text-gray-700">Total Batches</p>
                <p className="text-2xl font-bold text-gray-900">{batches.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/50 p-5 sm:p-6 transition-all duration-300 hover:shadow-xl">
            <div className="flex items-center">
              <div className="p-3 bg-gradient-to-r from-emerald-500 to-green-500 rounded-xl">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-semibold text-gray-700">Active Students</p>
                <p className="text-2xl font-bold text-gray-900">
                  {batches.reduce((total, batch) => total + (batch.students?.length || 0), 0)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/50 p-5 sm:p-6 transition-all duration-300 hover:shadow-xl">
            <div className="flex items-center">
              <div className="p-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-semibold text-gray-700">This Month</p>
                <p className="text-2xl font-bold text-gray-900">+{batches.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Add Batch Form Section */}
        <div className="mb-6 sm:mb-8" id="add-batch-form">
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/50 p-5 sm:p-6 transition-all duration-300 hover:shadow-xl">
            <div className="flex items-center mb-4">
              <div className="w-2 h-2 rounded-full bg-blue-500 mr-3"></div>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-800">Create New Batch</h2>
            </div>
            <AddBatchForm token={token} setBatches={setBatches} />
          </div>
        </div>

        {/* Batch List Section */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/50 p-5 sm:p-6 transition-all duration-300 hover:shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5 sm:mb-6">
            <div className="flex items-center">
              <div className="w-2 h-2 rounded-full bg-green-500 mr-3"></div>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-800">Your Batches</h2>
            </div>
            {batches.length > 0 && (
              <div className="self-start sm:self-auto text-xs sm:text-sm text-gray-600 bg-gray-100/50 px-3 py-1 rounded-full">
                {batches.length} batch{batches.length !== 1 ? "es" : ""}
              </div>
            )}
          </div>

          {batches.length === 0 ? (
            <div className="text-center py-10 sm:py-12 px-2">
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400" />
              </div>
              <p className="text-gray-500 text-base sm:text-lg font-medium mb-2">No batches created yet</p>
              <p className="text-gray-400 mb-6">Create your first batch to get started with managing classes</p>
              <button
                onClick={() => {
                  const el = document.getElementById("add-batch-form");
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className="w-full sm:w-auto px-5 sm:px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
              >
                ➕ Add Batch
              </button>
            </div>
          ) : (
            <BatchList batches={batches} setBatches={setBatches} token={token} />
          )}
        </div>
      </div>
    </div>
  );
};

export default TeacherDashboard;
