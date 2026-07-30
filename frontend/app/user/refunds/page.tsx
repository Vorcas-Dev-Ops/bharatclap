import React from "react";
import CancellationsPage from "@/components/user/bookings/CancellationsPage";

export const metadata = {
  title: "Refunds & Cancellations | BharatClap",
  description: "View your cancelled services and refund status",
};

export default function RefundsPage() {
  return <CancellationsPage />;
}
