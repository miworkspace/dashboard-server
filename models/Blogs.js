import mongoose from "mongoose";

const faqSchema = new mongoose.Schema(
  {
    question: { type: String, trim: true, maxlength: 200, required: true },
    answer: { type: String, trim: true, maxlength: 1000, required: true },
  },
  { _id: false },
);

const blogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: 200,
    },

    slug: {
      type: String,
      required: [true, "Slug is required"],
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 200,
    },

    content: { type: String, required: [true, "Content is required"] },

    category: { type: String, trim: true, maxlength: 60, default: "" },
    tags: { type: [String], default: [] },
    excerpt: { type: String, trim: true, maxlength: 300, default: "" },

    // Cloudinary image — publicId lagbe delete/replace korar jonno
    coverImage: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
    },

    // SEO fields (optional — page title/excerpt e fallback korbe)
    seoTitle: { type: String, trim: true, maxlength: 70, default: "" },
    seoDescription: { type: String, trim: true, maxlength: 170, default: "" },
    focusKeyword: { type: String, trim: true, maxlength: 80, default: "" },

    faqs: {
      type: [faqSchema],
      default: [],
      validate: [(v) => v.length <= 10, "Maximum 10 FAQs allowed"],
    },

    status: {
      type: String,
      enum: ["draft", "published"],
      default: "published",
    },
  },
  { timestamps: true }, // createdAt, updatedAt auto
);

blogSchema.index({ status: 1, createdAt: -1 });

const Blog = mongoose.models.Blog || mongoose.model("Blog", blogSchema);

export default Blog;
