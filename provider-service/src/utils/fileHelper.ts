import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export interface CloudinaryUploadResponse {
  secure_url: string;
  public_id: string;
  resource_type: string;
}

/**
 * Detects file type from base64 data URI and uploads to the correct
 * Cloudinary bucket:
 *  - PDFs  → resource_type: 'raw'   → /raw/upload/ → browser-openable
 *  - Images → resource_type: 'image' → /image/upload/
 */
export const saveFileToCloud = async (
  base64Data: string,
  subDir: string
): Promise<CloudinaryUploadResponse> => {
  if (!base64Data) {
    throw new Error("No file provided");
  }

  const trimmed = base64Data.trim();
  const lower = trimmed.toLowerCase();

  // Reject unsafe schemes
  if (lower.startsWith("javascript:") || lower.startsWith("vbscript:") || lower.startsWith("data:text/")) {
    throw new Error("Unsafe file or URL scheme detected");
  }

  // Already an uploaded HTTP/HTTPS URL — return as-is
  if (trimmed.startsWith("https://") || trimmed.startsWith("http://")) {
    return {
      secure_url: trimmed,
      public_id: "",
      resource_type: "image",
    };
  }

  // Extract MIME type from data URI: data:<mimeType>;base64,...
  const mimeMatch = trimmed.match(/^data:([^;]+);base64,/);
  if (!mimeMatch) {
    throw new Error("Invalid file upload format: expected valid data URI or HTTP/HTTPS URL");
  }

  const mimeType = mimeMatch[1]?.toLowerCase() ?? "";
  const allowedMimeTypes = [
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/bmp",
  ];

  if (!allowedMimeTypes.includes(mimeType)) {
    throw new Error(`Unsupported file type: ${mimeType}. Allowed formats: PDF, JPEG, PNG, WebP, GIF, BMP`);
  }

  console.log(`[CLOUDINARY UPLOAD] Detected MIME type: "${mimeType}"`);

  // Route PDFs to the 'raw' bucket so browsers can open them natively.
  // All other files (jpg, png, gif, webp, etc.) go to the 'image' bucket.
  const isPdf = mimeType === "application/pdf" || mimeType.includes("pdf");
  const resourceType: "raw" | "image" = isPdf ? "raw" : "image";

  try {
    const uploadResponse = await cloudinary.uploader.upload(base64Data, {
      folder: `serviceapp/${subDir}`,
      resource_type: resourceType,
    });

    console.log(
      `[CLOUDINARY UPLOAD] Success — resource_type: "${uploadResponse.resource_type}", url: ${uploadResponse.secure_url}`
    );

    return {
      secure_url: uploadResponse.secure_url,
      public_id: uploadResponse.public_id,
      resource_type: uploadResponse.resource_type,
    };
  } catch (err: any) {
    console.error("[CLOUDINARY UPLOAD] Error:", err);
    throw new Error(`Cloud Storage Error: ${err.message || 'Unknown upload error'}`);
  }
};

/**
 * Deletes a file from Cloudinary.
 * @param publicId  The Cloudinary public_id stored in the database.
 * @param resourceType  Must match the bucket used during upload ('image' | 'raw' | 'video').
 */
export const deleteFileFromCloud = async (
  publicId: string,
  resourceType = "image"
): Promise<void> => {
  if (!publicId) return;

  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
    console.log(`[CLOUDINARY DELETE] publicId: "${publicId}", result:`, result);
  } catch (err) {
    console.error("[CLOUDINARY DELETE] Error:", err);
  }
};
