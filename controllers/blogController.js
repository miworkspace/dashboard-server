import mongoose from "mongoose";
import Blog from "../models/Blogs.js";
import asyncHandler from "../utils/asyncHandler.js";
import {
  uploadImage,
  deleteImage,
  BLOG_CONTENT_FOLDER,
} from "../utils/cloudinaryUpload.js";
import { buildBlogData, BLOG_STATUSES } from "../utils/blogHelpers.js";

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const slugTaken = (slug, excludeId) =>
  Blog.exists(excludeId ? { slug, _id: { $ne: excludeId } } : { slug });

function getPagination(query) {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(
    Math.max(Number.parseInt(query.limit, 10) || DEFAULT_LIMIT, 1),
    MAX_LIMIT,
  );

  return { page, limit, skip: (page - 1) * limit };
}

async function listBlogs(filter, query) {
  const { page, limit, skip } = getPagination(query);

  const [blogs, total] = await Promise.all([
    Blog.find(filter)
      .select("-content -faqs")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Blog.countDocuments(filter),
  ]);

  return {
    blogs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    },
  };
}

// =====================================================
// GET /api/blogs?page=1&limit=12&status=draft   (dashboard)
// =====================================================
export const getBlogs = asyncHandler(async (req, res) => {
  const filter = BLOG_STATUSES.includes(req.query.status)
    ? { status: req.query.status }
    : {};

  const [result, counts] = await Promise.all([
    listBlogs(filter, req.query),
    Blog.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);

  const stats = { total: 0, published: 0, draft: 0 };
  for (const { _id, count } of counts) {
    if (_id in stats) stats[_id] = count;
    stats.total += count;
  }

  res.json({ success: true, ...result, stats });
});

// =====================================================
// GET /api/blogs/public?page=1&limit=12   (public site)
// =====================================================
export const getPublishedBlogs = asyncHandler(async (req, res) => {
  const result = await listBlogs({ status: "published" }, req.query);
  res.json({ success: true, ...result });
});

// =====================================================
// GET /api/blogs/public/:slug   (public site)
// =====================================================
export const getPublishedBlogBySlug = asyncHandler(async (req, res) => {
  const blog = await Blog.findOne({
    slug: String(req.params.slug).toLowerCase(),
    status: "published",
  }).lean();

  if (!blog) {
    return res.status(404).json({ success: false, message: "Blog not found." });
  }

  res.json({ success: true, blog });
});

// =====================================================
// GET /api/blogs/:id   (dashboard — drafts included)
// =====================================================
export const getBlogById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!isValidId(id)) {
    return res.status(400).json({ success: false, message: "Invalid blog ID." });
  }

  const blog = await Blog.findById(id).lean();

  if (!blog) {
    return res.status(404).json({ success: false, message: "Blog not found." });
  }

  res.json({ success: true, blog });
});

// =====================================================
// POST /api/blogs   (multipart/form-data, image field: coverImage)
// =====================================================
export const createBlog = asyncHandler(async (req, res) => {
  const { data, error } = buildBlogData(req.body);

  if (error) {
    return res.status(400).json({ success: false, message: error });
  }

  if (await slugTaken(data.slug)) {
    return res.status(409).json({
      success: false,
      message: "A blog with this slug already exists.",
    });
  }

  let uploaded = null;

  try {
    if (req.file) uploaded = await uploadImage(req.file.buffer);

    const blog = await Blog.create({
      ...data,
      coverImage: uploaded || { url: "", publicId: "" },
    });

    res.status(201).json({
      success: true,
      message: "Blog created successfully.",
      blog,
    });
  } catch (err) {
    // DB save failed — remove the image we just uploaded
    if (uploaded) await deleteImage(uploaded.publicId);
    throw err;
  }
});

// =====================================================
// PUT /api/blogs/:id   (multipart/form-data)
// A new image replaces the old one; removeCoverImage=true clears it.
// =====================================================
export const updateBlog = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!isValidId(id)) {
    return res.status(400).json({ success: false, message: "Invalid blog ID." });
  }

  const existingBlog = await Blog.findById(id).select("slug coverImage").lean();

  if (!existingBlog) {
    return res.status(404).json({ success: false, message: "Blog not found." });
  }

  const { data, error } = buildBlogData(req.body, { partial: true });

  if (error) {
    return res.status(400).json({ success: false, message: error });
  }

  if (data.slug && (await slugTaken(data.slug, id))) {
    return res.status(409).json({
      success: false,
      message: "A blog with this slug already exists.",
    });
  }

  const oldPublicId = existingBlog.coverImage?.publicId;
  const removeCover = String(req.body?.removeCoverImage) === "true";
  let uploaded = null;

  try {
    if (req.file) {
      uploaded = await uploadImage(req.file.buffer);
      data.coverImage = uploaded;
    } else if (removeCover) {
      data.coverImage = { url: "", publicId: "" };
    }

    const blog = await Blog.findByIdAndUpdate(
      id,
      { $set: data },
      { returnDocument: "after", runValidators: true },
    );

    // Old image is deleted only after the DB update succeeded
    if (data.coverImage) await deleteImage(oldPublicId);

    res.json({ success: true, message: "Blog updated successfully.", blog });
  } catch (err) {
    if (uploaded) await deleteImage(uploaded.publicId);
    throw err;
  }
});

// =====================================================
// POST /api/blogs/images   (multipart/form-data, field: image)
// Images inserted inside the editor content.
// =====================================================
export const uploadContentImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "Image is required." });
  }

  const { url } = await uploadImage(req.file.buffer, {
    folder: BLOG_CONTENT_FOLDER,
  });

  res.status(201).json({ success: true, url });
});

// =====================================================
// DELETE /api/blogs/:id
// =====================================================
export const deleteBlog = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!isValidId(id)) {
    return res.status(400).json({ success: false, message: "Invalid blog ID." });
  }

  const deletedBlog = await Blog.findByIdAndDelete(id);

  if (!deletedBlog) {
    return res.status(404).json({ success: false, message: "Blog not found." });
  }

  await deleteImage(deletedBlog.coverImage?.publicId);

  res.json({ success: true, message: "Blog deleted successfully." });
});
