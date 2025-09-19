// // Backend/src/models/Batch.js
// import mongoose from "mongoose";

// const subjectSchema = new mongoose.Schema({
//   name: { type: String, required: true },
//   chapters: [{ type: String }] // fixed strings for chapters
// });

// const batchSchema = new mongoose.Schema({
//   name: { type: String, required: true },
//   teacher: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true },
//   city: { type: String, required: true },
//   subjects: [subjectSchema], // NEW
//   createdAt: { type: Date, default: Date.now }
// });

// export default mongoose.model("Batch", batchSchema);


// Backend/src/models/Batch.js
import mongoose from "mongoose";

const subjectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  chapters: [{ type: String }]
});

const BATCH_TYPES = ["Ammar", "Miqdaad", "Bilal", "Abuzar", "Salman"]; // extend if needed

const batchSchema = new mongoose.Schema({
  name: { type: String, required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true },
  city: { type: String, required: true },
  batchType: { type: String, enum: BATCH_TYPES, default: null }, // NEW
  subjects: [subjectSchema], // embedded subjects + chapters
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Batch", batchSchema);
