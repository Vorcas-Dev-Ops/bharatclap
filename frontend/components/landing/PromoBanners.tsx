"use client";

import React from "react";
import BannerSlot from "@/components/common/BannerSlot";

export default function PromoBanners({ placement = "homepage_after_categories" }: { placement?: string }) {
  return <BannerSlot placement={placement} />;
}
