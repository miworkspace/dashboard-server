import mongoose from "mongoose";
import dotenv from "dotenv";
import Department from "../models/Department.js";
import DeviceType from "../models/DeviceType.js";

dotenv.config();

const collections = [
  { label: "departments", model: Department },
  { label: "device categories", model: DeviceType },
];

try {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured");
  }

  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  });

  for (const { label, model } of collections) {
    const collection = model.collection;
    const indexes = await collection.indexes();
    const legacyIndex = indexes.find(
      (index) =>
        index.name === "code_1" &&
        index.unique === true &&
        Object.keys(index.key).length === 1 &&
        index.key.code === 1,
    );

    if (!legacyIndex) {
      console.log(`${label}: no obsolete code_1 index found`);
      continue;
    }

    await collection.dropIndex("code_1");
    console.log(`${label}: removed obsolete unique code_1 index`);
  }
} catch (error) {
  console.error("Failed to remove legacy master-data indexes:", error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
