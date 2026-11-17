import mongoose from "mongoose";

const activitySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    userName: { type: String, required: true, maxlength: 100 },
    userEmail: { type: String, required: true, maxlength: 254 },
    role: { type: String, required: true, maxlength: 50 },
    action: { type: String, required: true, maxlength: 100 },
    module: { type: String, required: true, maxlength: 100 },
    record: { type: String, default: "", maxlength: 200 },
    details: { type: String, default: "", maxlength: 300 },
    method: { type: String, default: "", maxlength: 10 },
    path: { type: String, required: true, maxlength: 300 },
    status: { type: Number, default: 200 },
    type: {
      type: String,
      enum: ["login", "page_view", "mutation"],
      required: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

activitySchema.index({ createdAt: -1 });
activitySchema.index({ user: 1, createdAt: -1 });

export default mongoose.models.Activity ||
  mongoose.model("Activity", activitySchema);
