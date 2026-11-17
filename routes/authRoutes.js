import express from "express";

import {
  login,
  getMe,
  updateMe,
  changePassword,
  logout,
} from "../controllers/authController.js";

import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/login", login);
router.get("/me", authenticate, getMe);
router.patch("/me", authenticate, updateMe);
router.patch("/change-password", authenticate, changePassword);
router.post("/logout", authenticate, logout);

export default router;
