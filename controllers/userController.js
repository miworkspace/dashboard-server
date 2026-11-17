import mongoose from "mongoose";
import User from "../models/User.js";
import Role from "../models/Role.js";

const allowedRoles = ["admin", "manager"];

const publicUser = (user) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  phone: user.phone,
  employeeId: user.employeeId,
  image: user.image,
  department: user.department,
  designation: user.designation,
  role: user.role,
  isActive: user.isActive,
  lastLoginAt: user.lastLoginAt,
  createdBy: user.createdBy?.toString?.() ?? null,
  updatedBy: user.updatedBy?.toString?.() ?? null,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const actorId = (req) => {
  const id = req.user?.id;
  return id && mongoose.isValidObjectId(id) ? id : null;
};

const validId = (id) => mongoose.isValidObjectId(id);

const normalizeProfile = (body = {}) => ({
  name: typeof body.name === "string" ? body.name.trim() : "",
  email: typeof body.email === "string" ? body.email.trim().toLowerCase() : "",
  phone: typeof body.phone === "string" ? body.phone.trim() : "",
  employeeId:
    typeof body.employeeId === "string"
      ? body.employeeId.trim().toUpperCase()
      : "",
  image: typeof body.image === "string" ? body.image.trim() : "",
  department: typeof body.department === "string" ? body.department.trim() : "",
  designation:
    typeof body.designation === "string" ? body.designation.trim() : "",
});

const validateProfile = (profile) => {
  if (profile.name.length < 2 || profile.name.length > 100)
    return "Name must be 2–100 characters";
  if (!/^\S+@\S+\.\S+$/.test(profile.email) || profile.email.length > 254)
    return "Enter a valid email address";
  if (profile.phone.length > 20) return "Phone must be 20 characters or fewer";
  if (profile.employeeId.length > 50)
    return "Employee ID must be 50 characters or fewer";
  if (profile.image.length > 2048) return "Image URL is too long";
  if (profile.image && !/^https?:\/\/\S+$/i.test(profile.image))
    return "Image must be an http(s) URL";
  if (profile.department.length > 100 || profile.designation.length > 100)
    return "Department or designation is too long";
  return null;
};

async function findDuplicate(profile, excludeId = null) {
  const conditions = [{ email: profile.email }];
  if (profile.employeeId) conditions.push({ employeeId: profile.employeeId });
  const query = { $or: conditions };
  if (excludeId) query._id = { $ne: excludeId };
  return User.findOne(query).select("email employeeId").lean();
}

// GET /api/users
export const getUsers = async (req, res, next) => {
  try {
    const users = await User.find()
      .select(
        "name email phone employeeId image department designation role isActive lastLoginAt createdBy updatedBy createdAt updatedAt",
      )
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.status(200).json({
      success: true,
      count: users.length,
      data: users.map((user) => ({
        ...user,
        id: user._id.toString(),
        createdBy: user.createdBy?.toString() ?? null,
        updatedBy: user.updatedBy?.toString() ?? null,
      })),
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/users — admin only via route middleware
export const createUser = async (req, res, next) => {
  try {
    const profile = normalizeProfile(req.body);
    const { password, role = "manager", accessRole } = req.body ?? {};

    const validationError = validateProfile(profile);
    if (
      validationError ||
      typeof password !== "string" ||
      password.length < 6 ||
      password.length > 128
    ) {
      return res.status(400).json({
        success: false,
        message: validationError || "Password must be 6–128 characters",
      });
    }

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ success: false, message: "Invalid role" });
    }

    const by = actorId(req);
    if (!by)
      return res
        .status(401)
        .json({ success: false, message: "Authenticated user not found" });

    const duplicate = await findDuplicate(profile);
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message:
          duplicate.email === profile.email
            ? "Email already exists"
            : "Employee ID already exists",
      });
    }
    let validAccessRole = null;

    if (accessRole !== undefined && accessRole !== null && accessRole !== "") {
      const roleExists = await Role.findOne({
        _id: accessRole,
        isActive: true,
      });

      if (!roleExists) {
        return res.status(400).json({
          success: false,
          message: "Invalid or inactive role.",
        });
      }

      validAccessRole = roleExists._id;
    }

    const user = await User.create({
      ...profile,
      employeeId: profile.employeeId || undefined,
      password,
      role,
      accessRole: validAccessRole,
      isActive: true,
      createdBy: by,
      updatedBy: by,
    });

    return res.status(201).json({
      success: true,
      message: "User created successfully",
      data: publicUser(user),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Email or Employee ID already exists",
      });
    }
    next(error);
  }
};

// PUT /api/users/:id — update employee fields; password is optional
export const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!validId(id))
      return res
        .status(400)
        .json({ success: false, message: "Invalid user ID" });

    const by = actorId(req);
    if (!by)
      return res
        .status(401)
        .json({ success: false, message: "Authenticated user not found" });

    const target = await User.findById(id).select("+tokenVersion");
    if (!target)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    const profile = normalizeProfile(req.body);
    const validationError = validateProfile(profile);
    if (validationError)
      return res.status(400).json({ success: false, message: validationError });

    if (req.body?.role !== undefined && !allowedRoles.includes(req.body.role)) {
      return res.status(400).json({ success: false, message: "Invalid role" });
    }
    if (
      req.body?.isActive !== undefined &&
      typeof req.body.isActive !== "boolean"
    ) {
      return res
        .status(400)
        .json({ success: false, message: "isActive must be a boolean" });
    }
    if (req.body?.password !== undefined && req.body.password !== "") {
      if (
        typeof req.body.password !== "string" ||
        req.body.password.length < 6 ||
        req.body.password.length > 128
      ) {
        return res.status(400).json({
          success: false,
          message: "Password must be 6–128 characters",
        });
      }
      target.password = req.body.password;
      target.tokenVersion += 1;
    }

    const duplicate = await findDuplicate(profile, target._id);
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message:
          duplicate.email === profile.email
            ? "Email already exists"
            : "Employee ID already exists",
      });
    }

    if (req.body?.role !== undefined) {
      const nextRole = req.body.role;
      if (target._id.toString() === by.toString() && nextRole !== "admin") {
        return res.status(400).json({
          success: false,
          message: "You cannot demote your own account",
        });
      }
      if (target.role === "admin" && nextRole !== "admin" && target.isActive) {
        const activeAdmins = await User.countDocuments({
          role: "admin",
          isActive: true,
        });
        if (activeAdmins <= 1)
          return res.status(400).json({
            success: false,
            message: "Cannot demote the last active admin",
          });
      }
      target.role = nextRole;
    }

    if (req.body?.isActive !== undefined) {
      const nextActive = req.body.isActive;
      if (target._id.toString() === by.toString() && !nextActive) {
        return res.status(400).json({
          success: false,
          message: "You cannot deactivate your own account",
        });
      }
      if (target.role === "admin" && target.isActive && !nextActive) {
        const activeAdmins = await User.countDocuments({
          role: "admin",
          isActive: true,
        });
        if (activeAdmins <= 1)
          return res.status(400).json({
            success: false,
            message: "Cannot deactivate the last active admin",
          });
      }
      if (target.isActive && !nextActive) target.tokenVersion += 1;
      target.isActive = nextActive;
    }

    target.name = profile.name;
    target.email = profile.email;
    target.phone = profile.phone;
    target.employeeId = profile.employeeId || undefined;
    target.image = profile.image;
    target.department = profile.department;
    target.designation = profile.designation;
    target.updatedBy = by;

    await target.save();

    return res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: publicUser(target),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Email or Employee ID already exists",
      });
    }
    next(error);
  }
};

// PATCH /api/users/:id/role
export const updateUserRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role, accessRole } = req.body ?? {};
    if (!validId(id))
      return res
        .status(400)
        .json({ success: false, message: "Invalid user ID" });
    if (!allowedRoles.includes(role))
      return res
        .status(400)
        .json({ success: false, message: "Role must be admin or manager" });

    const by = actorId(req);
    if (!by)
      return res
        .status(401)
        .json({ success: false, message: "Authenticated user not found" });
    if (id === by && role !== "admin")
      return res.status(400).json({
        success: false,
        message: "You cannot demote your own account",
      });

    const target = await User.findById(id);
    if (!target)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    if (target.role === "admin" && role !== "admin" && target.isActive) {
      const activeAdmins = await User.countDocuments({
        role: "admin",
        isActive: true,
      });

      if (accessRole !== undefined) {
        if (accessRole === null || accessRole === "") {
          target.accessRole = null;
        } else {
          const roleExists = await Role.findOne({
            _id: accessRole,
            isActive: true,
          });

          if (!roleExists) {
            return res.status(400).json({
              success: false,
              message: "Invalid or inactive role.",
            });
          }

          target.accessRole = roleExists._id;
        }
      }
      if (activeAdmins <= 1)
        return res.status(400).json({
          success: false,
          message: "Cannot demote the last active admin",
        });
    }

    target.role = role;
    target.updatedBy = by;
    await target.save();

    return res.status(200).json({
      success: true,
      message: "User role updated successfully",
      data: publicUser(target),
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/users/:id/status
export const updateUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body ?? {};
    if (!validId(id))
      return res
        .status(400)
        .json({ success: false, message: "Invalid user ID" });
    if (typeof isActive !== "boolean")
      return res
        .status(400)
        .json({ success: false, message: "isActive must be a boolean" });

    const by = actorId(req);
    if (!by)
      return res
        .status(401)
        .json({ success: false, message: "Authenticated user not found" });
    if (id === by && !isActive)
      return res.status(400).json({
        success: false,
        message: "You cannot deactivate your own account",
      });

    const target = await User.findById(id).select("+tokenVersion");
    if (!target)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    if (target.role === "admin" && target.isActive && !isActive) {
      const activeAdmins = await User.countDocuments({
        role: "admin",
        isActive: true,
      });
      if (activeAdmins <= 1)
        return res.status(400).json({
          success: false,
          message: "Cannot deactivate the last active admin",
        });
    }

    if (target.isActive && !isActive) target.tokenVersion += 1;
    target.isActive = isActive;
    target.updatedBy = by;
    await target.save();

    return res.status(200).json({
      success: true,
      message: "User status updated successfully",
      data: publicUser(target),
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/users/:id — permanent deletion; admin only via route middleware
export const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!validId(id))
      return res
        .status(400)
        .json({ success: false, message: "Invalid user ID" });

    const by = actorId(req);
    if (!by)
      return res
        .status(401)
        .json({ success: false, message: "Authenticated user not found" });
    if (id === by)
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own account",
      });

    const target = await User.findById(id);
    if (!target)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    if (target.role === "admin" && target.isActive) {
      const activeAdmins = await User.countDocuments({
        role: "admin",
        isActive: true,
      });
      if (activeAdmins <= 1)
        return res.status(400).json({
          success: false,
          message: "Cannot delete the last active admin",
        });
    }

    await User.deleteOne({ _id: target._id });

    return res
      .status(200)
      .json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    next(error);
  }
};
