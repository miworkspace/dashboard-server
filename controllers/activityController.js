import Activity from "../models/Activity.js";

const MODULE_NAMES = {
  auth: "Account",
  activity: "Activity",
  dashboard: "Dashboard",
  devices: "Devices",
  images: "Images",
  "master-data": "Master Data",
  rbac: "Access Control",
  rooms: "Rooms",
  users: "Users",
};

function getModuleName(path) {
  const segment = path.split("/").filter(Boolean)[1] || "dashboard";

  if (MODULE_NAMES[segment]) return MODULE_NAMES[segment];

  return segment
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export async function writeActivity({
  user,
  action,
  module,
  record = "",
  details = "",
  method = "",
  path,
  status = 200,
  type,
}) {
  if (!user?.id || !path) return;

  try {
    await Activity.create({
      user: user.id,
      userName: user.name || user.email || "User",
      userEmail: user.email || "",
      role: user.role || "manager",
      action,
      module,
      record,
      details,
      method,
      path,
      status,
      type,
    });
  } catch (error) {
    console.error("Failed to persist activity log:", error);
  }
}

export function captureMutationActivity(req, res, next) {
  const method = req.method.toUpperCase();
  const path = req.originalUrl.split("?")[0];
  const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  const isActivityEndpoint = path.startsWith("/api/activity");

  if (isMutation && !isActivityEndpoint) {
    res.once("finish", () => {
      if (res.statusCode < 200 || res.statusCode >= 400 || !req.user) return;

      const actionByMethod = {
        POST: "Created",
        PUT: "Updated",
        PATCH: "Updated",
        DELETE: "Deleted",
      };
      const module = getModuleName(path);
      const record = path.split("/").filter(Boolean).slice(2).join("/");
      // Controllers can set res.locals.activity for a readable log entry
      const custom = res.locals.activity || {};

      void writeActivity({
        user: req.user,
        action: actionByMethod[method],
        module,
        record: custom.record || record || module,
        details: custom.details || `${method} ${path}`,
        method,
        path,
        status: res.statusCode,
        type: "mutation",
      });
    });
  }

  next();
}

export async function getActivities(req, res, next) {
  try {
    const rawLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(rawLimit, 1), 200)
      : 100;
    const query = req.user.role === "admin" ? {} : { user: req.user.id };

    const activities = await Activity.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return res.status(200).json({
      success: true,
      activities: activities.map((activity) => ({
        id: activity._id.toString(),
        user: activity.userName,
        email: activity.userEmail,
        role: activity.role,
        action: activity.action,
        module: activity.module,
        record: activity.record,
        details: activity.details,
        method: activity.method,
        path: activity.path,
        status: activity.status,
        type: activity.type,
        timestamp: activity.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
}

export async function recordPageView(req, res, next) {
  try {
    const { path, title } = req.body ?? {};

    if (
      typeof path !== "string" ||
      !path.startsWith("/dashboard") ||
      path.length > 300 ||
      typeof title !== "string" ||
      !title.trim() ||
      title.length > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid dashboard page path and title are required",
      });
    }

    await writeActivity({
      user: req.user,
      action: "Viewed Page",
      module: title.trim(),
      record: path,
      details: `Opened ${title.trim()}`,
      method: "GET",
      path,
      status: 200,
      type: "page_view",
    });

    return res.status(201).json({ success: true });
  } catch (error) {
    next(error);
  }
}

export async function clearActivities(req, res, next) {
  try {
    await Activity.deleteMany({});
    return res.status(200).json({
      success: true,
      message: "Activity history cleared",
    });
  } catch (error) {
    next(error);
  }
}
