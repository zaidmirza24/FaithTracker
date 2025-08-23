import React from "react";
import { Navigate } from "react-router-dom";

const PrivateRoute = ({ children, roles }) => {
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user"));

  // If no token or user, redirect to login
  if (!token || !user) return <Navigate to="/login" replace />;

  // If user role is not allowed, redirect to login
  if (roles && !roles.includes(user.role)) return <Navigate to="/login" replace />;

  return children;
};

export default PrivateRoute;
