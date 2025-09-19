// scripts/addBatchSubjects.js
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import Batch from "../src/models/Batch.js"; // adjust path if needed

const MONGO = process.env.MONGO_URI || "mongodb://localhost:27017/faithtracker";

async function run() {
  await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log("Connected to", MONGO);

  // Choose one of the two seed options below:
  // 1) Add empty subjects arrays to batches that don't have subjects:
//   const res1 = await Batch.updateMany(
//     { $or: [{ subjects: { $exists: false } }, { subjects: null }] },
//     { $set: { subjects: [] } }
//   );
//   console.log("Updated (empty subjects) count:", res1.nModified || res1.modifiedCount || res1.n);

  // 2) Or seed with an example (uncomment if you want example content)
  
  const exampleSubjects = [
    { name: "Aqaed", chapters: ["Ch1", "Ch2", "Ch3"] },
    { name: "Ahkaam", chapters: ["Ch1", "Ch2"] }
  ];
  const res2 = await Batch.updateMany(
    { $or: [{ subjects: { $exists: false } }, { subjects: null }] },
    { $set: { subjects: exampleSubjects } }
  );
  console.log("Updated (example subjects) count:", res2.nModified || res2.modifiedCount || res2.n);
  

  await mongoose.disconnect();
  console.log("Done.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
