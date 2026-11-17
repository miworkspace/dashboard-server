import { Router } from "express";
import {
  clearActivities,
  getActivities,
  recordPageView,
} from "../controllers/activityController.js";
import { authenticate, authorizeRoles } from "../middleware/authMiddleware.js";

const router = Router();

router.use(authenticate);
router.get("/", getActivities);
router.post("/page-view", recordPageView);
router.delete("/", authorizeRoles("admin"), clearActivities);

export default router;
