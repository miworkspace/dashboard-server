import mongoose from "mongoose";

const permissionSchema = new mongoose.Schema(
  {
    menu: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Menu",
      required: true,
    },

    actions: {
      type: [String],
      enum: ["view", "create", "edit", "delete"],
      default: [],
    },
  },
  { _id: false },
);

const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
    },

    permissions: {
      type: [permissionSchema],
      default: [],
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

const Role = mongoose.model("Role", roleSchema);

export default Role;
