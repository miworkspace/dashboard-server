import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },
    phone: { type: String, trim: true, maxlength: 20, default: "" },
    employeeId: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 50,
      unique: true,
      sparse: true,
    },
    image: { type: String, trim: true, maxlength: 2048, default: "" },
    department: { type: String, trim: true, maxlength: 100, default: "" },
    designation: { type: String, trim: true, maxlength: 100, default: "" },
    role: {
      type: String,
      enum: ["admin", "manager"],
      default: "manager",
      required: true,
    },
    accessRole: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      default: null,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      maxlength: 128,
      select: false,
    },
    isActive: { type: Boolean, default: true },
    tokenVersion: { type: Number, default: 0, min: 0, select: false },
    lastLoginAt: { type: Date, default: null },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true, versionKey: false },
);

userSchema.pre("save", async function () {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 12);
  }
});

userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.models.User || mongoose.model("User", userSchema);
