import React, { useState } from "react";
import { createBatch, deleteBatch } from "../../src/services/teacherService";

const AddBatchForm = ({ token, setBatches }) => {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) return setError("Batch name is required");
    
    setLoading(true);
    try {
      const newBatch = await createBatch(name, token);
      setBatches(prev => [...prev, newBatch]);
      setName("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create batch");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mb-6 flex gap-2">
      <input
        type="text"
        value={name}
        placeholder="Batch name"
        onChange={(e) => setName(e.target.value)}
        className="border p-2 rounded flex-1"
      />
      <button
        type="submit"
        disabled={loading}
        className="bg-blue-500 text-white px-4 rounded hover:bg-blue-600"
      >
        {loading ? "Adding..." : "Add Batch"}
      </button>
      {error && <p className="text-red-500 mt-2">{error}</p>}
    </form>
  );
};

export default AddBatchForm;
