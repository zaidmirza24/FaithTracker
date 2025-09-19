#!/usr/bin/env node
/**
 * updateSubjects.js
 *
 * Run with:
 *   node scripts/updateSubjects.js
 *
 * It will connect to MongoDB, and for each batchType defined in SUBJECT_MAP,
 * update all matching batches with the subjects/chapters defined below.
 *
 * ⚠️ This script OVERWRITES existing subjects.
 * Make a DB backup before running in production.
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import Batch from "../src/models/Batch.js"; // adjust path if needed

const MONGO = process.env.MONGO_URI || "mongodb://localhost:27017/faithtracker";

/**
 * Define all subjects/chapters for each batchType here.
 */
const SUBJECT_MAP = {
  Ammar: [
    { name: "Aqaed", chapters: ["Ch1", "Ch2", "Ch3"] },
    { name: "Ahkaam", chapters: ["Ch1", "Ch2"] }
  ],
  Miqdaad: [
    { name: "Math", chapters: ["Numbers", "Algebra I", "Algebra II"] },
    { name: "Science", chapters: ["Biology Basics", "Chemistry Intro"] }
  ],
  Bilal: [
    { name: "Quran", chapters: ["Surah 1", "Surah 2", "Surah 3"] },
    { name: "Aqaid", chapters: ["Tawheed", "Imaan"] }
  ],
  Abuzar: [
    { name: "History", chapters: ["Islamic History I", "Islamic History II"] },
    { name: "Arabic", chapters: ["Alphabet", "Basic Phrases"] }
  ],
  Salman: [
    { name: "Computer", chapters: ["Intro", "Basics", "Advanced"] },
    { name: "Math", chapters: ["Arithmetic", "Algebra"] }
  ]
};

async function run() {
  await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log("Connected to DB:", MONGO);

  for (const [batchType, subjects] of Object.entries(SUBJECT_MAP)) {
    const res = await Batch.updateMany(
      { batchType },
      { $set: { subjects } }
    );
    console.log(`BatchType "${batchType}" updated: ${res.modifiedCount || res.nModified} document(s).`);
  }

  await mongoose.disconnect();
  console.log("Done.");
}

run().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
