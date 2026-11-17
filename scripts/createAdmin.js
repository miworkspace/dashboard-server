import "dotenv/config";

import mongoose from "mongoose";
import connectDB from "../config/db.js";
import User from "../models/User.js";

const createFirstAdmin = async () => {
  try {
    const { BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD } = process.env;

    if (!BOOTSTRAP_ADMIN_EMAIL || !BOOTSTRAP_ADMIN_PASSWORD) {
      throw new Error("Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD");
    }

    if (
      BOOTSTRAP_ADMIN_PASSWORD.length < 12 ||
      BOOTSTRAP_ADMIN_PASSWORD.length > 128
    ) {
      throw new Error("Admin password must be 12–128 characters");
    }

    await connectDB();

    const existingAdmin = await User.exists({
      role: "admin",
    });

    if (existingAdmin) {
      throw new Error("An admin already exists. Bootstrap cancelled.");
    }

    const email = BOOTSTRAP_ADMIN_EMAIL.trim().toLowerCase();

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      throw new Error("This email already belongs to another user");
    }

    const admin = await User.create({
      name: "System Administrator",
      email,
      password: BOOTSTRAP_ADMIN_PASSWORD,
      role: "admin",
      isActive: true,
    });

    console.log("First admin created:", admin.email);
  } catch (error) {
    console.error("Admin bootstrap failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
};

await createFirstAdmin();
