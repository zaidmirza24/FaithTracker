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
const allowed = process.env.CLIENT_ORIGIN?.split(","); // allow multiple, comma-separated
// Allow only your frontend
app.use(cors({
  origin: ["https://faith-tracker.onrender.com","http://localhost:5173"],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

// If you want to allow multiple origins:
const allowedOrigins = [
  "https://faith-tracker.onrender.com",
  "http://localhost:5173" // for local testing
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true
}));

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
