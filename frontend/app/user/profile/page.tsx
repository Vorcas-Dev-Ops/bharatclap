"use client";

import React from "react";
import Navbar from "@/components/common/Navbar";
import Footer from "@/components/common/Footer";
import CustomerProfileForm from "@/components/user/profile/CustomerProfileForm";

export default function ProfilePage() {
  return (
    <main className="min-h-screen bg-[#FCF8FF]">
      <Navbar />
      <div className="py-12">
        <div className="max-w-4xl mx-auto px-4">
          <h1 className="text-2xl font-bold text-slate-800 mb-8">My Profile</h1>
          <CustomerProfileForm />
        </div>
      </div>
      <Footer />
    </main>
  );
}
