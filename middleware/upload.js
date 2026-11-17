import multer from "multer";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter(req, file, cb) {
    const allowed = ["image/jpeg", "image/png", "image/webp"];

    if (!allowed.includes(file.mimetype)) {
      const error = new Error("Only JPEG, PNG and WebP images are allowed.");
      error.status = 400;
      error.expose = true;
      return cb(error);
    }

    cb(null, true);
  },
});

export default upload;
