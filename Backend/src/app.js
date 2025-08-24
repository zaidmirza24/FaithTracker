import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import authRoutes from "./routes/auth.route.js";
import teacherRoutes from "./routes/teacher.route.js";
import adminRoutes from "./routes/admin.route.js";
import reportsRoutes from "./routes/reports.route.js"; // ✅ new

const app = express();

// Middleware
app.use(express.json());


// If you want to allow multiple origins:
// app.use(cors({
//   origin:"http://localhost:5173"
// }))
app.use(cors({
  origin:"https://faith-tracker.onrender.com"
}))

app.use(helmet());
app.use(morgan("dev"));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/teacher", teacherRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/reports", reportsRoutes); // ✅ attach reports routes

app.get("/", (req, res) => {
  res.json({ message: "API is running 🚀" });
});

export default app;
