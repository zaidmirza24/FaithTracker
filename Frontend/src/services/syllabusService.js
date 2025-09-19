// Frontend/src/services/syllabusService.js
import axios from "axios";
import { API_BASE } from "../config/api";

const authHeader = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

export const getSyllabus = async (batchId, date, token) => {
  const params = date ? { date } : {};
  const response = await axios.get(`${API_BASE}/teacher/batches/${batchId}/syllabus`, {
    params,
    ...authHeader(token),
  });
  return response.data;
};

export const saveSyllabus = async (batchId, date, entries, token) => {
  const response = await axios.post(
    `${API_BASE}/teacher/batches/${batchId}/syllabus`,
    { date, entries },
    authHeader(token)
  );
  return response.data;
};

// Admin export (download) - provides the file stream
export const exportMonthlySyllabus = async (batchId, month, year, token) => {
  const params = { batchId, month, year };
  const response = await axios.get(`${API_BASE}/reports/syllabus/export`, {
    params,
    responseType: "blob",
    ...authHeader(token),
  });
  // create download link
  const blob = new Blob([response.data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `syllabus_${year}_${month}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};
