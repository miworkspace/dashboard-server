import mongoose from "mongoose";

const menuSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    // Page URL. Group menu-এর জন্য null থাকবে।
    path: {
      type: String,
      default: null,
      trim: true,
    },

    icon: {
      type: String,
      default: "circle",
      trim: true,
    },

    // group = Dropdown Parent, page = Actual Page
    type: {
      type: String,
      enum: ["group", "page"],
      default: "page",
      required: true,
    },

    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Menu",
      default: null,
    },

    order: {
      type: Number,
      default: 0,
    },

    actions: {
      type: [String],
      enum: ["view", "create", "edit", "delete"],
      default: ["view"],
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
  {
    timestamps: true,
  },
);

menuSchema.index({ parent: 1, order: 1 });

const Menu = mongoose.models.Menu || mongoose.model("Menu", menuSchema);

export default Menu;
