import User from "../models/User.js";
import Menu from "../models/Menu.js";

export const loadRBACUser = async (req, res, next) => {
  try {
    const userId = req.user?._id || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const user = await User.findById(userId).populate({
      path: "accessRole",
      populate: {
        path: "permissions.menu",
        select: "name slug path type actions isActive",
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: "User account is inactive or unavailable.",
      });
    }

    req.rbacUser = user;

    next();
  } catch (error) {
    next(error);
  }
};

// Only Super Admin
export const requireSuperAdmin = (req, res, next) => {
  if (req.rbacUser?.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Super Admin permission required.",
    });
  }

  next();
};

const ALL_ACTIONS = ["view", "create", "edit", "delete"];

// Actions a user may perform on a menu/page, e.g. ["view", "edit"].
// Expects the user loaded by loadRBACUser (accessRole populated).
export function getAllowedActions(user, menuSlug) {
  if (!user) return [];

  // Super Admin bypass
  if (user.role === "admin") return ALL_ACTIONS;

  const permissions = user.accessRole?.permissions || [];

  const allowed = permissions
    .filter((permission) => {
      const menu = permission.menu;
      const slug = typeof menu === "object" ? menu?.slug : null;
      return slug === menuSlug;
    })
    .flatMap((permission) => permission.actions || []);

  return [...new Set(allowed)];
}

// Check Page Permission
// action: "edit" or an array like ["create", "edit"] (any one is enough)
export const requirePermission = (menuSlug, action) => {
  const actions = Array.isArray(action) ? action : [action];

  return async (req, res, next) => {
    try {
      const user = req.rbacUser || req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
      }

      const userActions = getAllowedActions(user, menuSlug);
      const allowed = actions.some((item) => userActions.includes(item));

      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to perform this action.",
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
