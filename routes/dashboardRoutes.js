import express from "express";

import { authenticate, authorizeRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get(
  "/overview",
  authenticate,
  authorizeRoles("admin", "manager"),
  (req, res) => {
    res.status(200).json({
      success: true,
      message: "Dashboard access granted",
      data: {
        user: req.user,
        availableModules:
          req.user.role === "admin"
            ? ["posts", "users", "settings", "analytics"]
            : ["posts", "analytics"],
      },
    });
  },
);

router.get(
  "/admin-settings",
  authenticate,
  authorizeRoles("admin"),
  (req, res) => {
    res.status(200).json({
      success: true,
      message: "Admin settings access granted",
    });
  },
);

export default router;
