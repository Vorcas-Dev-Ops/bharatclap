import React, { Suspense } from "react";
import RegisterForm from "@/components/common/RegisterForm";

export default function RegisterVerifyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F3F4F8] flex items-center justify-center p-4">Loading...</div>}>
      <RegisterForm />
    </Suspense>
  );
}
