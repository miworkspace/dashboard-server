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

// Check Page Permission
export const requirePermission = (menuSlug, action) => {
  return async (req, res, next) => {
    try {
      const user = req.rbacUser || req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
      }

      // Super Admin bypass
      if (user.role === "admin") {
        return next();
      }

      const permissions = user.accessRole?.permissions || [];

      const allowed = permissions.some((permission) => {
        const menu = permission.menu;

        const slug = typeof menu === "object" ? menu.slug : null;

        return slug === menuSlug && permission.actions?.includes(action);
      });

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
