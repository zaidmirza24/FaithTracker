// Backend/src/models/Syllabus.js
import mongoose from "mongoose";

const syllabusEntrySchema = new mongoose.Schema({
  subject: { type: String, required: true },
  chapter: { type: String, required: true },
  remark: { type: String, default: "" },
});

const syllabusSchema = new mongoose.Schema({
  batch: { type: mongoose.Schema.Types.ObjectId, ref: "Batch", required: true },
  date: { type: Date, required: true }, // normalized to start-of-day
  entries: [syllabusEntrySchema],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher" },
  createdAt: { type: Date, default: Date.now },
});

// compound index for efficient lookups
syllabusSchema.index({ batch: 1, date: 1 }, { unique: true });
syllabusSchema.index({ batch: 1, createdAt: -1 });

export default mongoose.model("Syllabus", syllabusSchema);
