import mongoose from "mongoose";
import Menu from "../models/Menu.js";
import Role from "../models/Role.js";

const allowedActions = ["view", "create", "edit", "delete"];

function validId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function normalizePath(path) {
  if (!path) return null;

  const value = String(path).trim();

  if (!value.startsWith("/") || value.startsWith("//")) {
    return null;
  }

  return value.replace(/\/+$/, "") || "/";
}

// Build hierarchical menus
function buildTree(menus, parentId = null) {
  return menus
    .filter((menu) => {
      const currentParent = menu.parent ? menu.parent.toString() : null;

      return currentParent === parentId;
    })
    .sort((a, b) => a.order - b.order)
    .map((menu) => ({
      ...menu,
      children: buildTree(menus, menu._id.toString()),
    }));
}

// GET /api/rbac/menus
// Admin: all active and inactive menus
export const getMenus = async (req, res, next) => {
  try {
    const menus = await Menu.find().sort({ order: 1, name: 1 }).lean();

    return res.status(200).json({
      success: true,
      menus: buildTree(menus),
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/rbac/sidebar
// Admin sees all active menus.
// Manager sees only pages with view permission.
export const getSidebarMenus = async (req, res, next) => {
  try {
    const user = req.rbacUser || req.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Authenticated user not found",
      });
    }

    const allMenus = await Menu.find({ isActive: true })
      .sort({ order: 1, name: 1 })
      .lean();

    // Super Admin
    if (user.role === "admin") {
      return res.status(200).json({
        success: true,
        menus: buildTree(allMenus),
      });
    }

    const permissions = user.accessRole?.permissions || [];

    const allowedPageIds = new Set(
      permissions
        .filter((permission) => permission.actions?.includes("view"))
        .map((permission) =>
          permission.menu?._id
            ? permission.menu._id.toString()
            : permission.menu?.toString(),
        )
        .filter(Boolean),
    );

    // Only permitted pages
    const permittedPages = allMenus.filter(
      (menu) => menu.type === "page" && allowedPageIds.has(menu._id.toString()),
    );

    // Include their parent groups automatically
    const requiredParentIds = new Set();

    for (const page of permittedPages) {
      if (page.parent) {
        requiredParentIds.add(page.parent.toString());
      }
    }

    const visibleMenus = allMenus.filter(
      (menu) =>
        permittedPages.some(
          (page) => page._id.toString() === menu._id.toString(),
        ) || requiredParentIds.has(menu._id.toString()),
    );

    return res.status(200).json({
      success: true,
      menus: buildTree(visibleMenus),
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/rbac/menus
export const createMenu = async (req, res, next) => {
  try {
    const {
      name,
      slug,
      path,
      icon,
      type = "page",
      parent = null,
      order = 0,
      actions = ["view"],
      isActive = true,
    } = req.body;

    if (!name?.trim() || !slug?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Menu name and slug are required.",
      });
    }

    if (!["group", "page"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid menu type.",
      });
    }

    if (
      !Array.isArray(actions) ||
      actions.some((action) => !allowedActions.includes(action))
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid menu actions.",
      });
    }

    let parentMenu = null;

    if (parent) {
      if (!validId(parent)) {
        return res.status(400).json({
          success: false,
          message: "Invalid parent menu ID.",
        });
      }

      parentMenu = await Menu.findOne({
        _id: parent,
        type: "group",
      });

      if (!parentMenu) {
        return res.status(400).json({
          success: false,
          message: "Parent must be an existing group menu.",
        });
      }
    }

    if (type === "group" && path) {
      return res.status(400).json({
        success: false,
        message: "Group menu cannot have a page URL.",
      });
    }

    if (type === "page" && !normalizePath(path)) {
      return res.status(400).json({
        success: false,
        message: "A valid page URL is required.",
      });
    }

    const normalizedSlug = slug.trim().toLowerCase().replace(/\s+/g, "-");

    const duplicate = await Menu.findOne({
      $or: [
        { slug: normalizedSlug },
        ...(type === "page" ? [{ path: normalizePath(path) }] : []),
      ],
    });

    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: "Menu slug or page URL already exists.",
      });
    }

    const menu = await Menu.create({
      name: name.trim(),
      slug: normalizedSlug,
      path: type === "page" ? normalizePath(path) : null,
      icon: icon || "circle",
      type,
      parent: parent || null,
      order: Number(order) || 0,
      actions,
      isActive: Boolean(isActive),
      createdBy: req.user?._id || req.rbacUser?._id,
      updatedBy: req.user?._id || req.rbacUser?._id,
    });

    return res.status(201).json({
      success: true,
      message: "Menu created successfully.",
      menu,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Menu slug already exists.",
      });
    }

    next(error);
  }
};

// PATCH /api/rbac/menus/:id
export const updateMenu = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!validId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid menu ID.",
      });
    }

    const menu = await Menu.findById(id);

    if (!menu) {
      return res.status(404).json({
        success: false,
        message: "Menu not found.",
      });
    }

    const { name, slug, path, icon, type, parent, order, actions, isActive } =
      req.body;

    const nextType = type ?? menu.type;

    if (!["group", "page"].includes(nextType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid menu type.",
      });
    }

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Menu name is required.",
        });
      }
      menu.name = name.trim();
    }

    if (slug !== undefined) {
      const normalizedSlug = slug.trim().toLowerCase().replace(/\s+/g, "-");

      if (!normalizedSlug) {
        return res.status(400).json({
          success: false,
          message: "Menu slug is required.",
        });
      }

      const duplicate = await Menu.findOne({
        slug: normalizedSlug,
        _id: { $ne: id },
      });

      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: "Menu slug already exists.",
        });
      }

      menu.slug = normalizedSlug;
    }

    if (parent !== undefined) {
      if (parent === null || parent === "") {
        menu.parent = null;
      } else {
        if (!validId(parent) || parent.toString() === id) {
          return res.status(400).json({
            success: false,
            message: "Invalid parent menu.",
          });
        }

        const parentMenu = await Menu.findOne({
          _id: parent,
          type: "group",
        });

        if (!parentMenu) {
          return res.status(400).json({
            success: false,
            message: "Parent must be a group menu.",
          });
        }

        menu.parent = parent;
      }
    }

    if (nextType === "group") {
      const children = await Menu.countDocuments({
        parent: id,
      });

      if (children > 0) {
        return res.status(400).json({
          success: false,
          message: "A menu with children cannot become a page.",
        });
      }

      if (path) {
        return res.status(400).json({
          success: false,
          message: "Group menu cannot have a page URL.",
        });
      }

      menu.path = null;
      menu.actions = ["view"];
      menu.parent = null;
    } else {
      const nextPath = path !== undefined ? normalizePath(path) : menu.path;

      if (!nextPath) {
        return res.status(400).json({
          success: false,
          message: "A valid page URL is required.",
        });
      }

      const duplicatePath = await Menu.findOne({
        path: nextPath,
        _id: { $ne: id },
      });

      if (duplicatePath) {
        return res.status(409).json({
          success: false,
          message: "Page URL already exists.",
        });
      }

      menu.path = nextPath;
    }

    menu.type = nextType;

    if (icon !== undefined) menu.icon = icon;
    if (order !== undefined) menu.order = Number(order) || 0;

    if (actions !== undefined) {
      if (
        !Array.isArray(actions) ||
        actions.some((action) => !allowedActions.includes(action))
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid menu actions.",
        });
      }

      menu.actions = actions;
    }

    if (isActive !== undefined) {
      if (typeof isActive !== "boolean") {
        return res.status(400).json({
          success: false,
          message: "isActive must be a boolean.",
        });
      }

      menu.isActive = isActive;
    }

    menu.updatedBy = req.user?._id || req.rbacUser?._id;

    await menu.save();

    return res.status(200).json({
      success: true,
      message: "Menu updated successfully.",
      menu,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Menu already exists.",
      });
    }

    next(error);
  }
};

// DELETE /api/rbac/menus/:id
export const deleteMenu = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!validId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid menu ID.",
      });
    }

    const menu = await Menu.findById(id);

    if (!menu) {
      return res.status(404).json({
        success: false,
        message: "Menu not found.",
      });
    }

    const children = await Menu.countDocuments({
      parent: id,
    });

    if (children > 0) {
      return res.status(400).json({
        success: false,
        message: "Delete or move child menus before deleting this group.",
      });
    }

    // Remove deleted menu from existing Role permissions
    await Role.updateMany(
      {},
      {
        $pull: {
          permissions: { menu: menu._id },
        },
      },
    );

    await menu.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Menu deleted successfully.",
    });
  } catch (error) {
    next(error);
  }
};
