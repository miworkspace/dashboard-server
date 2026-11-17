import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import connectDB from "./config/db.js";
import { notFound, errorHandler } from "./middleware/errorMiddleware.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import imageRoutes from "./routes/imageRoutes.js";
import rbacRoutes from "./routes/rbacRoutes.js";
import activityRoutes from "./routes/activityRoutes.js";
import { captureMutationActivity } from "./controllers/activityController.js";

const app = express();

app.disable("x-powered-by");
app.use(helmet());

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  }),
);

app.use(express.json({ limit: "20kb" }));
app.use(
  express.urlencoded({
    extended: true,
    limit: "20kb",
  }),
);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login attempts. Try again later.",
  },
});

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is connected Boss :)",
  });
});

// Vercel invokes the exported app per request, so initialize the database
// lazily instead of requiring a long-running listener during deployment.
app.use("/api", async (req, res, next) => {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 64) {
    return res.status(500).json({
      success: false,
      message: "Server authentication is not configured",
    });
  }

  try {
    await connectDB();
    next();
  } catch (error) {
    next(error);
  }
});

app.use("/api", captureMutationActivity);
app.use("/api/auth/login", loginLimiter);
app.use("/api/activity", activityRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/images", imageRoutes);
app.use("/api/rbac", rbacRoutes);

app.use(notFound);
app.use(errorHandler);

const startServer = async () => {
  try {
    await connectDB();

    const port = Number(process.env.PORT) || 5000;

    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
};

// Vercel detects this root server.js and serves the exported Express app.
// Start a listener only when running directly outside Vercel.
if (!process.env.VERCEL) {
  startServer();
}

export default app;
