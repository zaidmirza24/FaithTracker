import mongoose from "mongoose";

const teacherSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  city: { type: String, required: true }
}, { timestamps: true });

export default mongoose.model("Teacher", teacherSchema);
