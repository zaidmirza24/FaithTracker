import mongoose from "mongoose";

const studentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String },
  batch: { type: mongoose.Schema.Types.ObjectId, ref: "Batch", required: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Student", studentSchema);
