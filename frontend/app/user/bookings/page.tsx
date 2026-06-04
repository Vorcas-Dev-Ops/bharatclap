"use client";

import React from "react";
import Navbar from "@/components/common/Navbar";
import Footer from "@/components/common/Footer";
import BookingHistory from "@/components/user/bookings/BookingHistory";

export default function BookingsPage() {
  return (
    <>
      <BookingHistory />
      <Footer />
    </>
  );
}
