import express from "express";

import {
  getMenus,
  getSidebarMenus,
  createMenu,
  updateMenu,
  deleteMenu,
} from "../controllers/menuController.js";

import {
  getRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
} from "../controllers/roleController.js";

import {
  loadRBACUser,
  requireSuperAdmin,
} from "../middleware/permissionMiddleware.js";

import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

// All RBAC routes require authentication and current RBAC user
router.use(authenticate, loadRBACUser);

// Sidebar: every authenticated user
router.get("/sidebar", getSidebarMenus);

// Menu management: Super Admin only
router.get("/menus", requireSuperAdmin, getMenus);
router.post("/menus", requireSuperAdmin, createMenu);
router.patch("/menus/:id", requireSuperAdmin, updateMenu);
router.delete("/menus/:id", requireSuperAdmin, deleteMenu);

// Role management: Super Admin only
router.get("/roles", requireSuperAdmin, getRoles);
router.get("/roles/:id", requireSuperAdmin, getRoleById);
router.post("/roles", requireSuperAdmin, createRole);
router.patch("/roles/:id", requireSuperAdmin, updateRole);
router.delete("/roles/:id", requireSuperAdmin, deleteRole);

export default router;
