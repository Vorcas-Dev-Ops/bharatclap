import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/apiResponse';
import { ErrorCodes } from '../constants/errorCodes';

export interface UploadValidationOptions {
  maxSizeBytes?: number; // default 5MB (5 * 1024 * 1024)
  allowedMimeTypes?: string[];
  allowedExtensions?: string[];
}

const DEFAULT_MAX_SIZE = 5 * 1024 * 1024; // 5MB
const DEFAULT_ALLOWED_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
];
const DEFAULT_ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.pdf'];
const DISALLOWED_EXTS = ['.exe', '.sh', '.bat', '.cmd', '.js', '.vbs', '.php', '.py', '.pl', '.cgi', '.dll', '.so'];

export const validateFileUpload = (options: UploadValidationOptions = {}) => {
  const maxSizeBytes = options.maxSizeBytes || DEFAULT_MAX_SIZE;
  const allowedMimes = options.allowedMimeTypes || DEFAULT_ALLOWED_MIMES;
  const allowedExts = options.allowedExtensions || DEFAULT_ALLOWED_EXTS;

  return (req: Request, res: Response, next: NextFunction): void => {
    // If request contains uploaded file(s) (multer attaches req.file or req.files)
    const file = (req as any).file;
    const files = (req as any).files;

    const fileList: any[] = [];
    if (file) fileList.push(file);
    if (Array.isArray(files)) fileList.push(...files);
    else if (files && typeof files === 'object') {
      Object.values(files).forEach((arr: any) => {
        if (Array.isArray(arr)) fileList.push(...arr);
      });
    }

    if (fileList.length === 0) {
      return next();
    }

    for (const f of fileList) {
      // 1. File Size Check
      if (f.size && f.size > maxSizeBytes) {
        sendError(
          res,
          400,
          `File size exceeds maximum limit of ${Math.round(maxSizeBytes / (1024 * 1024))}MB`,
          ErrorCodes.VALIDATION_ERROR,
          { fileName: f.originalname, sizeBytes: f.size }
        );
        return;
      }

      // 2. Extension Check
      const originalName = f.originalname || f.name || '';
      const ext = originalName.substring(originalName.lastIndexOf('.')).toLowerCase();

      if (DISALLOWED_EXTS.includes(ext)) {
        sendError(
          res,
          400,
          `File extension ${ext} is strictly prohibited for security reasons`,
          ErrorCodes.VALIDATION_ERROR,
          { fileName: originalName }
        );
        return;
      }

      if (allowedExts.length > 0 && !allowedExts.includes(ext)) {
        sendError(
          res,
          400,
          `File extension ${ext} is not allowed. Supported: ${allowedExts.join(', ')}`,
          ErrorCodes.VALIDATION_ERROR,
          { fileName: originalName }
        );
        return;
      }

      // 3. MIME Type Check
      if (f.mimetype && allowedMimes.length > 0 && !allowedMimes.includes(f.mimetype.toLowerCase())) {
        sendError(
          res,
          400,
          `File MIME type ${f.mimetype} is not allowed`,
          ErrorCodes.VALIDATION_ERROR,
          { fileName: originalName, mimeType: f.mimetype }
        );
        return;
      }
    }

    next();
  };
};
