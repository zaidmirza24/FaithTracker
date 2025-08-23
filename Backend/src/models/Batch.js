import mongoose from "mongoose";

const batchSchema = new mongoose.Schema({
  name: { type: String, required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true },
  city: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Batch", batchSchema);
