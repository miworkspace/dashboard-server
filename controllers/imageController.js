import sharp from "sharp";
import cloudinary from "../config/cloudinary.js";
import Image from "../models/Image.js";

async function uploadToCloudinary(buffer) {
  // Convert and optimize the image to WebP
  const optimizedBuffer = await sharp(buffer)
    .rotate()
    .resize({
      width: 800,
      height: 800,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({
      quality: 80,
      effort: 5,
    })
    .toBuffer();

  // Upload optimized WebP image to Cloudinary
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "it-management",
        resource_type: "image",
        format: "webp",
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      },
    );

    stream.end(optimizedBuffer);
  });
}

// Upload image
export async function uploadImage(req, res, next) {
  let uploaded;

  try {
    if (!req.file) {
      return res.status(400).json({ message: "Image is required." });
    }

    uploaded = await uploadToCloudinary(req.file.buffer);

    const image = await Image.create({
      title: req.body.title || "",
      imageUrl: uploaded.secure_url,
      publicId: uploaded.public_id,
    });

    res.status(201).json({
      message: "Image uploaded successfully",
      image,
    });
  } catch (error) {
    if (uploaded?.public_id) {
      await cloudinary.uploader.destroy(uploaded.public_id).catch(() => {});
    }

    next(error);
  }
}

// Update image
export async function updateImage(req, res, next) {
  let replacement;

  try {
    const image = await Image.findById(req.params.id);

    if (!image) {
      return res.status(404).json({ message: "Image not found." });
    }

    const oldPublicId = image.publicId;

    if (req.file) {
      replacement = await uploadToCloudinary(req.file.buffer);

      image.imageUrl = replacement.secure_url;
      image.publicId = replacement.public_id;
    }

    if (req.body.title !== undefined) {
      if (
        typeof req.body.title !== "string" ||
        req.body.title.trim().length > 100
      ) {
        return res.status(400).json({ message: "Invalid title." });
      }

      image.title = req.body.title.trim();
    }

    await image.save();

    if (replacement) {
      await cloudinary.uploader
        .destroy(oldPublicId)
        .catch((error) =>
          console.error("Old image cleanup failed:", error.message),
        );
    }

    res.json({
      message: "Image updated successfully",
      image,
    });
  } catch (error) {
    if (replacement?.public_id) {
      await cloudinary.uploader.destroy(replacement.public_id).catch(() => {});
    }

    next(error);
  }
}

// Delete image
export async function deleteImage(req, res, next) {
  try {
    const image = await Image.findById(req.params.id);

    if (!image) {
      return res.status(404).json({ message: "Image not found." });
    }

    await cloudinary.uploader.destroy(image.publicId);
    await image.deleteOne();

    res.json({ message: "Image deleted successfully" });
  } catch (error) {
    next(error);
  }
}
