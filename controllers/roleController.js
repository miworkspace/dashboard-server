import mongoose from "mongoose";
import Role from "../models/Role.js";
import Menu from "../models/Menu.js";
import User from "../models/User.js";

// Create Role
export const createRole = async (req, res, next) => {
  try {
    const { name, description, permissions = [] } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Role name is required.",
      });
    }

    const slug = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const existingRole = await Role.findOne({ slug });

    if (existingRole) {
      return res.status(409).json({
        success: false,
        message: "This role already exists.",
      });
    }

    const formattedPermissions = await validatePermissions(permissions);

    const role = await Role.create({
      name: name.trim(),
      slug,
      description,
      permissions: formattedPermissions,
      createdBy: req.user._id || req.user.id,
    });

    res.status(201).json({
      success: true,
      message: "Role created successfully.",
      role,
    });
  } catch (error) {
    next(error);
  }
};

// Get All Roles
export const getRoles = async (req, res, next) => {
  try {
    const roles = await Role.find()
      .populate("permissions.menu", "name slug path icon group actions")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: "Roles fetched successfully.",
      roles,
    });
  } catch (error) {
    next(error);
  }
};

// Get Single Role
export const getRoleById = async (req, res, next) => {
  try {
    const role = await Role.findById(req.params.id).populate(
      "permissions.menu",
      "name slug path icon group actions",
    );

    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found.",
      });
    }

    res.status(200).json({
      success: true,
      role,
    });
  } catch (error) {
    next(error);
  }
};

// Update Role
export const updateRole = async (req, res, next) => {
  try {
    const { name, description, permissions = [], isActive } = req.body;

    const role = await Role.findById(req.params.id);

    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found.",
      });
    }

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Role name cannot be empty.",
        });
      }

      const slug = name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      const duplicate = await Role.findOne({
        slug,
        _id: { $ne: role._id },
      });

      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: "This role name already exists.",
        });
      }

      role.name = name.trim();
      role.slug = slug;
    }

    if (description !== undefined) {
      role.description = description;
    }

    if (permissions !== undefined) {
      role.permissions = await validatePermissions(permissions);
    }

    if (isActive !== undefined) {
      role.isActive = isActive;
    }

    role.updatedBy = req.user._id || req.user.id;

    await role.save();

    res.status(200).json({
      success: true,
      message: "Role updated successfully.",
      role,
    });
  } catch (error) {
    next(error);
  }
};

// Delete Role
export const deleteRole = async (req, res, next) => {
  try {
    const role = await Role.findById(req.params.id);

    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found.",
      });
    }

    const assignedUsers = await User.countDocuments({
      accessRole: role._id,
    });

    if (assignedUsers > 0) {
      return res.status(400).json({
        success: false,
        message: `This role is assigned to ${assignedUsers} user(s). Reassign them before deleting.`,
      });
    }

    await role.deleteOne();

    res.status(200).json({
      success: true,
      message: "Role deleted successfully.",
    });
  } catch (error) {
    next(error);
  }
};

// Validate permissions before saving
async function validatePermissions(permissions) {
  if (!Array.isArray(permissions)) {
    throw new Error("Permissions must be an array.");
  }

  // Empty permissions are allowed.
  if (permissions.length === 0) {
    return [];
  }

  // Extract menu IDs.
  // Supports both ObjectId and populated menu objects.
  const menuIds = permissions.map((permission) => {
    return permission.menu?._id || permission.menu;
  });

  // Validate menu IDs and duplicates.
  if (
    menuIds.some((id) => !mongoose.isValidObjectId(id)) ||
    new Set(menuIds.map(String)).size !== menuIds.length
  ) {
    throw new Error("Invalid or duplicate menu permission.");
  }

  // Only active PAGE menus can receive permissions.
  // Parent groups cannot receive permissions.
  const menus = await Menu.find({
    _id: { $in: menuIds },
    type: "page",
    isActive: true,
  }).select("_id name slug type actions isActive parent");

  // Ensure every submitted menu is valid.
  if (menus.length !== menuIds.length) {
    throw new Error(
      "One or more menus are invalid, inactive, or not a page menu.",
    );
  }

  // Validate actions for each menu.
  return permissions.map((permission, index) => {
    const menuId = menuIds[index];

    const menu = menus.find(
      (item) => item._id.toString() === menuId.toString(),
    );

    if (!menu) {
      throw new Error("Invalid menu permission.");
    }

    const actions = permission.actions || [];

    if (!Array.isArray(actions)) {
      throw new Error("Actions must be an array.");
    }

    const uniqueActions = [...new Set(actions)];

    // Check whether requested actions exist in the menu.
    if (uniqueActions.some((action) => !menu.actions.includes(action))) {
      throw new Error(`Invalid action for menu: ${menu.name}`);
    }

    return {
      menu: menu._id,
      actions: uniqueActions,
    };
  });
}
