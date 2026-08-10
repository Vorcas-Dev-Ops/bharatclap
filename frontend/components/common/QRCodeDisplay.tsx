"use client";

import React from "react";

interface QRCodeDisplayProps {
  value: string;
  size?: number;
  className?: string;
}

export default function QRCodeDisplay({ value, size = 200, className = "" }: QRCodeDisplayProps) {
  if (!value) return null;

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}`;

  return (
    <img
      src={qrImageUrl}
      alt="Booking Payment QR Code"
      width={size}
      height={size}
      className={`rounded-2xl mx-auto ${className}`}
      loading="eager"
    />
  );
}
