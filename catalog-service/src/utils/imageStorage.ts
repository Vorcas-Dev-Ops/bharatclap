import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import crypto from 'crypto';

export type ResourceType = 'categories' | 'services' | 'sub-services' | 'banners';

import { getDb } from '../config/db';

export const MAX_IMAGE_SIZE_MB = Number(process.env.MAX_IMAGE_SIZE_MB) || 50;
export const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

export const UPLOADS_ROOT = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.resolve(__dirname, '../../uploads');

interface OptimizationPreset {
  width: number;
  height: number;
  fit: keyof sharp.FitEnum;
  quality: number;
  background?: { r: number; g: number; b: number; alpha: number };
}

const PRESETS: Record<ResourceType, OptimizationPreset> = {
  categories: {
    width: 256,
    height: 256,
    fit: 'contain',
    quality: 85,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
  services: {
    width: 800,
    height: 600,
    fit: 'inside',
    quality: 85,
  },
  'sub-services': {
    width: 600,
    height: 600,
    fit: 'inside',
    quality: 85,
  },
  banners: {
    width: 1200,
    height: 600,
    fit: 'inside',
    quality: 85,
  },
};

/**
 * Validate and process an uploaded raw image (base64 data URI).
 * - Strips EXIF/metadata
 * - Resizes according to resource preset
 * - Converts to optimized WebP
 * - Saves with an immutable UUID key: /uploads/{folder}/{slug}-{uuid}.webp
 * - Returns relative path: /uploads/{folder}/{filename}.webp
 * If the input is already a URL or /uploads/ path, returns it unchanged.
 */
export async function processAndStoreImage(
  rawImage?: string,
  folder: ResourceType = 'categories',
  slug?: string
): Promise<string | undefined> {
  if (!rawImage || typeof rawImage !== 'string') return undefined;

  const trimmed = rawImage.trim();
  if (!trimmed) return undefined;

  // Reject unsafe URL schemes
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('vbscript:') || lower.startsWith('data:text/')) {
    throw new Error('Unsafe URL scheme detected');
  }

  // If already a persisted /uploads path or external HTTP/HTTPS URL, preserve only valid schemes
  if (!trimmed.startsWith('data:image/')) {
    if (trimmed.startsWith('/uploads/') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    throw new Error('Invalid image format: must be /uploads/ path, HTTP/HTTPS URL, or data:image/ URI');
  }

  try {
    const mimeMatch = trimmed.match(/^data:image\/(jpeg|jpg|png|webp|gif|bmp);base64,/i);
    if (!mimeMatch) {
      throw new Error('Unsupported image format. Allowed formats: JPEG, PNG, WebP, GIF, BMP');
    }
    const base64Data = trimmed.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
      throw new Error(`Image size exceeds maximum allowed limit of ${MAX_IMAGE_SIZE_MB}MB (${(buffer.length / 1024 / 1024).toFixed(2)}MB)`);
    }

    const targetDir = path.join(UPLOADS_ROOT, folder);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const safeSlug = (slug || folder)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'item';

    const uniqueId = crypto.randomUUID();
    const filename = `${safeSlug}-${uniqueId}.webp`;
    const destPath = path.join(targetDir, filename);

    const preset = PRESETS[folder] || PRESETS.categories;

    let pipeline = sharp(buffer).rotate(); // auto-orient based on EXIF before stripping

    if (preset.background) {
      pipeline = pipeline.resize(preset.width, preset.height, {
        fit: preset.fit,
        background: preset.background,
      });
    } else {
      pipeline = pipeline.resize(preset.width, preset.height, {
        fit: preset.fit,
        withoutEnlargement: true,
      });
    }

    await pipeline
      .webp({ quality: preset.quality, effort: 6 })
      .toFile(destPath);

    return `/uploads/${folder}/${filename}`;
  } catch (err: any) {
    console.error(`[IMAGE-STORAGE] Error optimizing ${folder} image:`, err.message);
    throw new Error(`Failed to process image: ${err.message}`);
  }
}

/**
 * Safely delete an image from the local uploads directory.
 * Best-effort: catches errors and logs warnings, never throws.
 */
export async function deleteStoredImage(imageUrlOrKey?: string): Promise<boolean> {
  if (!imageUrlOrKey || typeof imageUrlOrKey !== 'string') return false;

  try {
    // Only attempt to delete files that live inside our /uploads directory
    const uploadsPrefix = '/uploads/';
    const index = imageUrlOrKey.indexOf(uploadsPrefix);
    if (index === -1) {
      // External URL or not an uploads file — nothing to delete locally
      return false;
    }

    const relativeSubPath = imageUrlOrKey.substring(index + uploadsPrefix.length);
    const resolvedPath = path.resolve(UPLOADS_ROOT, relativeSubPath);

    // Security check: prevent directory traversal attacks
    if (!resolvedPath.startsWith(path.resolve(UPLOADS_ROOT))) {
      console.warn(`[IMAGE-STORAGE] Directory traversal attempt blocked for: ${imageUrlOrKey}`);
      return false;
    }

    await fs.promises.unlink(resolvedPath);
    console.log(`[IMAGE-STORAGE] Successfully deleted old image: ${relativeSubPath}`);
    return true;
  } catch (err: any) {
    if (err?.code === 'ENOENT') {
      // File already doesn't exist — silent success
      return false;
    }
    console.warn(`[IMAGE-STORAGE] Failed to delete image (${imageUrlOrKey}):`, err.message);
    return false;
  }
}

/**
 * Helper to delete multiple stored images (best effort)
 */
export async function deleteMultipleStoredImages(imageUrls?: (string | undefined)[]): Promise<void> {
  if (!Array.isArray(imageUrls)) return;
  await Promise.all(
    imageUrls.filter(Boolean).map((url) => deleteStoredImage(url))
  );
}

/**
 * Backward compatibility alias for category icons
 */
export async function processCategoryIcon(
  rawIconOrImage?: string,
  slug?: string
): Promise<string | undefined> {
  return processAndStoreImage(rawIconOrImage, 'categories', slug);
}

/**
 * Scans UPLOADS_ROOT for image files that are no longer referenced in PostgreSQL.
 * Only deletes files older than gracePeriodHours (default 24h) to protect in-flight transactions.
 */
export async function cleanOrphanedImages(gracePeriodHours: number = 24): Promise<{
  scanned: number;
  deleted: number;
  skipped: number;
  errors: number;
}> {
  const result = { scanned: 0, deleted: 0, skipped: 0, errors: 0 };
  const pool = getDb();
  if (!pool) {
    console.warn('[ORPHAN-CLEANUP] Database connection not initialized, skipping cleanup');
    return result;
  }

  try {
    // 1. Fetch all referenced image paths across all catalog tables
    const dbRes = await pool.query(`
      SELECT DISTINCT trim(image_path) AS image_path FROM (
        SELECT icon AS image_path FROM catalog.categories WHERE icon IS NOT NULL
        UNION
        SELECT image AS image_path FROM catalog.categories WHERE image IS NOT NULL
        UNION
        SELECT unnest(images) AS image_path FROM catalog.services WHERE images IS NOT NULL
        UNION
        SELECT image AS image_path FROM catalog.subservices WHERE image IS NOT NULL
        UNION
        SELECT image AS image_path FROM catalog.banners WHERE image IS NOT NULL
      ) sub WHERE image_path IS NOT NULL AND image_path != ''
    `);

    const referencedSet = new Set<string>();
    for (const row of dbRes.rows) {
      const p = String(row.image_path).trim();
      referencedSet.add(p);
      // Also normalize without leading slash
      referencedSet.add(p.replace(/^\/+/, ''));
    }

    const folders: ResourceType[] = ['categories', 'services', 'sub-services', 'banners'];
    const cutoffTime = Date.now() - (gracePeriodHours * 60 * 60 * 1000);

    for (const folder of folders) {
      const folderPath = path.join(UPLOADS_ROOT, folder);
      if (!fs.existsSync(folderPath)) continue;

      const entries = await fs.promises.readdir(folderPath, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        result.scanned++;

        const relativePath = `/uploads/${folder}/${entry.name}`;
        const relativePathNoSlash = `uploads/${folder}/${entry.name}`;

        // Check if referenced in database
        if (referencedSet.has(relativePath) || referencedSet.has(relativePathNoSlash)) {
          result.skipped++;
          continue;
        }

        // Check file age (grace period check)
        const filePath = path.join(folderPath, entry.name);
        try {
          const stats = await fs.promises.stat(filePath);
          if (stats.mtimeMs < cutoffTime) {
            await fs.promises.unlink(filePath);
            result.deleted++;
            console.log(`[ORPHAN-CLEANUP] Deleted orphaned image: ${relativePath} (age: ${((Date.now() - stats.mtimeMs) / 3600000).toFixed(1)}h)`);
          } else {
            result.skipped++; // Within grace period
          }
        } catch (fileErr: any) {
          result.errors++;
          console.warn(`[ORPHAN-CLEANUP] Could not inspect/delete ${filePath}:`, fileErr.message);
        }
      }
    }

    console.log(`[ORPHAN-CLEANUP] Finished scan: ${result.scanned} scanned, ${result.deleted} deleted, ${result.skipped} active/grace-period, ${result.errors} errors.`);
  } catch (err: any) {
    console.error('[ORPHAN-CLEANUP] Error during scan:', err.message);
  }

  return result;
}
