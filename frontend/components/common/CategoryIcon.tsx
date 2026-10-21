"use client";

import React, { useState, useEffect } from "react";
import { Layers } from "lucide-react";

interface CategoryIconProps {
  icon?: string;
  name?: string;
  categoryName?: string;
  className?: string;
  size?: number;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({
  icon,
  name,
  categoryName,
  className = "w-5 h-5",
  size,
}) => {
  const [imgError, setImgError] = useState(false);
  const displayName = name || categoryName;

  useEffect(() => {
    setImgError(false);
  }, [icon]);

  // Resolve image source:
  // If it's a relative path like /uploads/..., keep it relative so Next.js rewrites it
  // seamlessly on the same origin (no CORS or 127.0.0.1 vs localhost mismatches).
  let resolvedSrc = icon || "";
  if (resolvedSrc.startsWith("uploads/")) {
    resolvedSrc = `/${resolvedSrc}`;
  }

  const isImageFile =
    resolvedSrc &&
    !imgError &&
    (resolvedSrc.startsWith("http://") ||
      resolvedSrc.startsWith("https://") ||
      resolvedSrc.startsWith("/uploads/") ||
      resolvedSrc.startsWith("data:") ||
      /\.(svg|png|jpg|jpeg|webp)$/i.test(resolvedSrc));

  if (isImageFile) {
    const fitClass = className.includes("object-") ? "" : "object-contain";
    const dim = size || 80;

    return (
      <img
        src={resolvedSrc}
        alt={displayName || "Category icon"}
        width={dim}
        height={dim}
        loading="eager"
        decoding="async"
        className={`${className} ${fitClass}`.trim()}
        onError={() => setImgError(true)}
      />
    );
  }

  // If no uploaded icon exists, render a clean modern subtle placeholder instead of hardcoded default icons
  return (
    <div className={`flex items-center justify-center rounded-2xl bg-slate-100 text-slate-400 ${className}`}>
      <Layers className="w-1/2 h-1/2 opacity-40" />
    </div>
  );
};

export default CategoryIcon;
