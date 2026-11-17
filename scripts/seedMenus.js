import mongoose from "mongoose";
import dotenv from "dotenv";
import Menu from "../models/Menu.js";

dotenv.config();

const menus = [
  {
    name: "Dashboard",
    slug: "dashboard",
    path: "/dashboard",
    icon: "layout-dashboard",
    group: "General",
    order: 1,
    actions: ["view"],
  },
  {
    name: "Inventory",
    slug: "inventory",
    path: "/dashboard/inventory",
    icon: "package",
    group: "Inventory",
    order: 1,
    actions: ["view", "create", "edit", "delete"],
  },
  {
    name: "Networks & IPs",
    slug: "networks",
    path: "/dashboard/networks",
    icon: "network",
    group: "Network Management",
    order: 1,
    actions: ["view", "create", "edit", "delete"],
  },
  {
    name: "VLANs",
    slug: "vlans",
    path: "/dashboard/vlans",
    icon: "git-branch",
    group: "Network Management",
    order: 2,
    actions: ["view", "create", "edit", "delete"],
  },
  {
    name: "Switches",
    slug: "switches",
    path: "/dashboard/switches",
    icon: "cable",
    group: "Network Management",
    order: 3,
    actions: ["view", "create", "edit", "delete"],
  },
  {
    name: "Rooms & Locations",
    slug: "rooms",
    path: "/dashboard/rooms",
    icon: "map-pin",
    group: "Infrastructure",
    order: 1,
    actions: ["view", "create", "edit", "delete"],
  },
  {
    name: "Wifi Devices",
    slug: "wifi-devices",
    path: "/dashboard/wifi-devices",
    icon: "activity",
    group: "Infrastructure",
    order: 2,
    actions: ["view", "create", "edit", "delete"],
  },
  {
    name: "Wifi Formatter",
    slug: "wifi-formatter",
    path: "/dashboard/wifi-formatter",
    icon: "wifi",
    group: "Tools",
    order: 1,
    actions: ["view"],
  },
  {
    name: "Activity Logs",
    slug: "activity",
    path: "/dashboard/activity",
    icon: "activity",
    group: "Administration",
    order: 1,
    actions: ["view"],
  },
  {
    name: "Blogs",
    slug: "blogs",
    path: "/dashboard/blogs",
    icon: "file-text",
    group: "Content",
    order: 7,
    actions: ["view", "create", "edit", "delete"],
  },
  {
    name: "User Management",
    slug: "users",
    path: "/dashboard/users",
    icon: "users",
    group: "Administration",
    order: 2,
    actions: ["view", "create", "edit", "delete"],
  },
  {
    name: "Master Data",
    slug: "master-data",
    path: "/dashboard/master-data",
    icon: "users",
    group: "Administration",
    order: 3,
    actions: ["view", "create", "edit", "delete"],
  },
  {
    name: "Role Management",
    slug: "roles",
    path: "/dashboard/roles",
    icon: "shield-check",
    group: "Administration",
    order: 4,
    actions: ["view"],
  },
  {
    name: "Settings",
    slug: "settings",
    path: "/dashboard/settings",
    icon: "settings",
    group: "Administration",
    order: 5,
    actions: ["view"],
  },
  {
    name: "Menu Management",
    slug: "menu-management",
    path: "/dashboard/menu-management",
    icon: "list-checks",
    type: "page",
    parent: null,
    order: 6,
    actions: ["view"],
    isActive: true,
  },
];

async function seedMenus() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    for (const menu of menus) {
      await Menu.findOneAndUpdate(
        { slug: menu.slug },
        { $set: menu },
        { upsert: true, new: true, runValidators: true },
      );
    }

    console.log("Menus seeded successfully.");

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("Menu seeding failed:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seedMenus();
