import { Router } from "express";
import {
  uploadImage,
  updateImage,
  deleteImage,
} from "../controllers/imageController.js";

import upload from "../middleware/upload.js";
import { authenticate, authorizeRoles } from "../middleware/authMiddleware.js";

const router = Router();

router.use(authenticate, authorizeRoles("admin", "manager"));

router.post("/", upload.single("image"), uploadImage);
router.patch("/:id", upload.single("image"), updateImage);
router.delete("/:id", deleteImage);

export default router;
