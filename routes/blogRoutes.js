import { Router } from "express";
import {
  getBlogs,
  getPublishedBlogs,
  getPublishedBlogBySlug,
  getBlogById,
  createBlog,
  updateBlog,
  deleteBlog,
  uploadContentImage,
} from "../controllers/blogController.js";
import { authenticate } from "../middleware/authMiddleware.js";
import {
  loadRBACUser,
  requirePermission,
} from "../middleware/permissionMiddleware.js";
import upload from "../middleware/upload.js";

const router = Router();

// Public (published blogs only) — must be declared before "/:id"
router.get("/public", getPublishedBlogs);
router.get("/public/:slug", getPublishedBlogBySlug);

// Dashboard — RBAC menu slug "blogs"
const canBlogs = (action) => [
  authenticate,
  loadRBACUser,
  requirePermission("blogs", action),
];

// Editor image upload — allowed while creating or editing a blog
router.post(
  "/images",
  canBlogs(["create", "edit"]),
  upload.single("image"),
  uploadContentImage,
);

router.get("/", canBlogs("view"), getBlogs);
router.get("/:id", canBlogs("view"), getBlogById);
router.post("/", canBlogs("create"), upload.single("coverImage"), createBlog);
router.put("/:id", canBlogs("edit"), upload.single("coverImage"), updateBlog);
router.delete("/:id", canBlogs("delete"), deleteBlog);

export default router;
