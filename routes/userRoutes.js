import { Router } from "express";
import {
  getUsers,
  createUser,
  updateUser,
  updateUserRole,
  updateUserStatus,
  deleteUser,
} from "../controllers/userController.js";
import { authenticate, authorizeRoles } from "../middleware/authMiddleware.js";

const router = Router();

// No public registration route: every endpoint requires an authenticated admin.
router.use(authenticate, authorizeRoles("admin"));

router.get("/", getUsers);
router.post("/", createUser);
router.put("/:id", updateUser);
router.patch("/:id/role", updateUserRole);
router.patch("/:id/status", updateUserStatus);
router.delete("/:id", deleteUser);

export default router;
