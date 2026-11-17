import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { writeActivity } from "./activityController.js";

const publicUser = (user) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
  isActive: user.isActive,
});

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      email.length > 254 ||
      password.length > 128
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid email and password are required",
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    }).select("+password");

    if (!user || !user.isActive || !(await user.comparePassword(password))) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    await writeActivity({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
      },
      action: "Signed In",
      module: "Account",
      record: user.email,
      details: "Signed in successfully",
      method: "POST",
      path: "/api/auth/login",
      status: 200,
      type: "login",
    });

    const token = jwt.sign(
      { tokenVersion: user.tokenVersion },
      process.env.JWT_SECRET,
      {
        subject: user._id.toString(),
        expiresIn: process.env.JWT_EXPIRES_IN || "12h",
        algorithm: "HS256",
      },
    );

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: publicUser(user),
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user.id, {
      $inc: { tokenVersion: 1 },
    });

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req, res) => {
  res.status(200).json({
    success: true,
    user: req.user,
  });
};

export const updateMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user || !user.isActive) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const profile = {
      name: req.body?.name ?? user.name,
      email:
        typeof req.body?.email === "string"
          ? req.body.email.trim().toLowerCase()
          : user.email,
      phone: req.body?.phone ?? user.phone,
      department: req.body?.department ?? user.department,
      designation: req.body?.designation ?? user.designation,
      image: req.body?.image ?? user.image,
    };

    if (
      typeof profile.name !== "string" ||
      profile.name.trim().length < 2 ||
      profile.name.trim().length > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Name must be 2–100 characters",
      });
    }
    if (
      typeof profile.email !== "string" ||
      !/^\S+@\S+\.\S+$/.test(profile.email) ||
      profile.email.length > 254
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid email address",
      });
    }
    if (typeof profile.phone !== "string" || profile.phone.length > 20) {
      return res.status(400).json({
        success: false,
        message: "Phone must be 20 characters or fewer",
      });
    }
    if (
      typeof profile.department !== "string" ||
      profile.department.length > 100 ||
      typeof profile.designation !== "string" ||
      profile.designation.length > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Department or designation is too long",
      });
    }
    if (
      typeof profile.image !== "string" ||
      profile.image.length > 2048 ||
      (profile.image && !/^https?:\/\/\S+$/i.test(profile.image))
    ) {
      return res.status(400).json({
        success: false,
        message: "Image must be a valid http(s) URL",
      });
    }

    const duplicate = await User.findOne({
      email: profile.email,
      _id: { $ne: user._id },
    })
      .select("_id")
      .lean();

    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: "Email already exists",
      });
    }

    user.name = profile.name.trim();
    user.email = profile.email;
    user.phone = profile.phone.trim();
    user.department = profile.department.trim();
    user.designation = profile.designation.trim();
    user.image = profile.image.trim();
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        employeeId: user.employeeId,
        image: user.image,
        department: user.department,
        designation: user.designation,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Email already exists",
      });
    }
    next(error);
  }
};

export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body ?? {};

    if (
      typeof currentPassword !== "string" ||
      typeof newPassword !== "string" ||
      newPassword.length < 8 ||
      newPassword.length > 128
    ) {
      return res.status(400).json({
        success: false,
        message: "Current password and a new 8–128 character password are required",
      });
    }

    const user = await User.findById(req.user.id).select(
      "+password +tokenVersion",
    );

    if (!user || !user.isActive) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!(await user.comparePassword(currentPassword))) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    const remainingSeconds =
      req.auth?.exp - Math.floor(Date.now() / 1000);
    if (!Number.isInteger(remainingSeconds) || remainingSeconds <= 0) {
      return res.status(401).json({
        success: false,
        message: "Session expired. Please sign in again.",
      });
    }

    user.password = newPassword;
    user.tokenVersion += 1;
    await user.save();

    const token = jwt.sign(
      { tokenVersion: user.tokenVersion },
      process.env.JWT_SECRET,
      {
        subject: user._id.toString(),
        expiresIn: remainingSeconds,
        algorithm: "HS256",
      },
    );

    return res.status(200).json({
      success: true,
      message: "Password changed successfully",
      token,
      expiresAt: req.auth.exp * 1000,
    });
  } catch (error) {
    next(error);
  }
};
