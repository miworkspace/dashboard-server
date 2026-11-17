import sharp from "sharp";
import cloudinary from "../config/cloudinary.js";

export const BLOG_FOLDER = "it-management/blogs";
export const BLOG_CONTENT_FOLDER = "it-management/blogs/content";

// Optimize an image to WebP and upload it to Cloudinary.
// Returns the shape stored in Blog.coverImage: { url, publicId }.
export async function uploadImage(buffer, { folder = BLOG_FOLDER } = {}) {
  const optimizedBuffer = await sharp(buffer)
    .rotate()
    .resize({ width: 1600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80, effort: 5 })
    .toBuffer();

  const result = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image", format: "webp" },
      (error, uploaded) => (error ? reject(error) : resolve(uploaded)),
    );

    stream.end(optimizedBuffer);
  });

  return { url: result.secure_url, publicId: result.public_id };
}

// Best-effort cleanup: a failed delete must never break the main request.
export async function deleteImage(publicId) {
  if (!publicId) return;

  await cloudinary.uploader
    .destroy(publicId)
    .catch((error) =>
      console.error("Cloudinary image cleanup failed:", error.message),
    );
}
