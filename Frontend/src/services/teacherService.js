import axios from "axios";
import {API_BASE} from "../config/api.js"

// const API_BASE = "http://localhost:5000/api/teacher";

export const getBatches = async (token) => {
  const response = await axios.get(`${API_BASE}/teacher/batches`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const createBatch = async (name, token) => {
  const response = await axios.post(
    `${API_BASE}/teacher/batches`,
    { name },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
};

export const deleteBatch = async (batchId, token) => {
  const response = await axios.delete(`${API_BASE}/teacher/batches/${batchId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};
