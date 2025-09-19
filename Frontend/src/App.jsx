import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import SyllabusPage from "./pages/SyllabusPage.jsx";
import SyllabusHistory from "./pages/SyllabusHistory";


import Login from "./pages/Login.jsx";

import TeacherDashboard from "./pages/TeacherDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import ManageBatches from "./pages/ManageBatches";
import ManageStudents from "./pages/ManageStudents";
import StudentList from "./components/StudentList.jsx";
import TeacherAttendance from "./pages/TeacherAttendance.jsx";
import AttendanceHistory from "./pages/AttendanceHistory.jsx";
import Reports from "./pages/Reports.jsx";
import CreateTeacherForm from "./pages/CreateTeacherForm.jsx"; // ✅ new

import PrivateRoute from "./components/PrivateRoute";

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Login />} />

        {/* Teacher Routes */}
        <Route
          path="/teacher/dashboard"
          element={
            <PrivateRoute roles={["teacher"]}>
              <TeacherDashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/teacher/batches"
          element={
            <PrivateRoute roles={["teacher"]}>
              <ManageBatches />
            </PrivateRoute>
          }
        />
        <Route
          path="/teacher/batches/:batchId/students"
          element={
            <PrivateRoute roles={["teacher"]}>
              <ManageStudents />
            </PrivateRoute>
          }
        />
        <Route
          path="/teacher/batch/:batchId"
          element={
            <PrivateRoute roles={["teacher"]}>
              <StudentList />
            </PrivateRoute>
          }
        />
        <Route
          path="/teacher/batch/:batchId/attendance-history"
          element={
            <PrivateRoute roles={["teacher"]}>
              <AttendanceHistory />
            </PrivateRoute>
          }
        />
        <Route
          path="/teacher/batches/:batchId/attendance"
          element={
            <PrivateRoute roles={["teacher"]}>
              <TeacherAttendance />
            </PrivateRoute>
          }
        />

        {/* Admin Routes */}
        <Route
          path="/admin/dashboard"
          element={
            <PrivateRoute roles={["admin"]}>
              <AdminDashboard />
            </PrivateRoute>
          }
        />
        {/* ✅ New: Admin Create Teacher */}
        <Route
          path="/admin/create-teacher"
          element={
            <PrivateRoute roles={["admin"]}>
              <CreateTeacherForm />
            </PrivateRoute>
          }
        />

        {/* Shared Reports */}
        <Route
          path="/reports"
          element={
            <PrivateRoute roles={["admin", "teacher"]}>
              <Reports />
            </PrivateRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Login />} />
      
        <Route
          path="/teacher/batch/:batchId/syllabus"
          element={
            <PrivateRoute roles={["teacher"]}>
              <SyllabusPage />
            </PrivateRoute>
          }
        />
        // Inside your Routes
        <Route path="/teacher/batch/:batchId/syllabus/history" element={
          <PrivateRoute roles={["teacher"]}>
            <SyllabusHistory />
          </PrivateRoute>
        } />
      </Routes>
    </Router>
  );
}

export default App;
