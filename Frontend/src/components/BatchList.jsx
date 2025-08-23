import React from "react";
import { useNavigate } from "react-router-dom";
import { deleteBatch } from "../../src/services/teacherService";
import { Settings, Trash2, MapPin, Users } from "lucide-react";

const BatchList = ({ batches, setBatches, token }) => {
  const navigate = useNavigate();

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this batch?")) return;

    try {
      await deleteBatch(id, token);
      setBatches((prev) => prev.filter((b) => b._id !== id));
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete batch");
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {batches.map((batch) => (
        <div
          key={batch._id}
          className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/50 p-6 hover:shadow-xl transition-all duration-300"
        >
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{batch.name}</h2>
              <div className="mt-2 inline-flex items-center gap-2 text-sm text-gray-600">
                <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-gray-100/70 border border-gray-200">
                  <MapPin className="w-3.5 h-3.5 mr-1 text-blue-600" />
                  {batch.city || "—"}
                </span>
                {Array.isArray(batch.students) && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-gray-100/70 border border-gray-200">
                    <Users className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                    {batch.students.length} student
                    {batch.students.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>
            <div className="flex space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
              <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
              <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
            </div>
          </div>

          {/* Divider */}
          <div className="my-5 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white font-semibold bg-gradient-to-r from-blue-500 to-indigo-500 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
              onClick={() => navigate(`/teacher/batch/${batch._id}`)}
              title="Manage batch"
            >
              <Settings className="w-4 h-4" />
              Manage
            </button>

            <button
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white font-semibold bg-gradient-to-r from-red-500 to-pink-500 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
              onClick={() => handleDelete(batch._id)}
              title="Delete batch"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default BatchList;
