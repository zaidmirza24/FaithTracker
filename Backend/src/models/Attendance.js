import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  batch: { type: mongoose.Schema.Types.ObjectId, ref: "Batch", required: true },
  date: { type: Date, default: Date.now },
  status: { type: String, enum: ["Present", "Absent","Holiday"], required: true },
  remarks: { type: String },
  studentName: { type: String, default: "" }
});

export default mongoose.model("Attendance", attendanceSchema);
