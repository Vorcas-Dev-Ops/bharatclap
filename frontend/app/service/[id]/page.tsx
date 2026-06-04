"use client";

import React, { use } from "react";
import { BookingOverview } from "@/components/services/booking/BookingOverview";

export default function BookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return <BookingOverview initialServiceId={id} />;
}
