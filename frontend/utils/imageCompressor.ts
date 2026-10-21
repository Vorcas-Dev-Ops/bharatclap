/**
 * Utility to compress and resize an existing data URL string.
 */
export async function optimizeDataUrl(
  dataUrl: string,
  maxWidth = 1000,
  maxHeight = 1000,
  quality = 0.85
): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith('data:image/') || dataUrl.startsWith('data:image/svg')) {
    return dataUrl;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      // If already small enough and string length is under 300KB, return as-is
      if (width <= maxWidth && height <= maxHeight && dataUrl.length < 300 * 1024) {
        resolve(dataUrl);
        return;
      }

      if (width > maxWidth || height > maxHeight) {
        if (width > height) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      const isPng = dataUrl.startsWith('data:image/png');
      const outputMime = isPng ? 'image/png' : 'image/jpeg';
      const compressed = canvas.toDataURL(outputMime, quality);
      resolve(compressed);
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * Utility to compress and resize an image File to a web-friendly data URL before uploading.
 * Prevents HTTP 413 "request entity too large" when admins select multi-megabyte camera photos.
 */
export async function fileToOptimizedDataUrl(
  file: File,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.85
): Promise<string> {
  // If SVG or non-image, fallback to raw FileReader
  if (file.type === 'image/svg+xml' || !file.type.startsWith('image/')) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const rawDataUrl = e.target?.result as string;
      const optimized = await optimizeDataUrl(rawDataUrl, maxWidth, maxHeight, quality);
      resolve(optimized);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

