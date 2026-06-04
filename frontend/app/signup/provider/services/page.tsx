import React, { Suspense } from "react";
import ProviderServiceSelection from "@/components/provider/ProviderServiceSelection";

export default function ProviderServiceRegistrationPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F3F4F8] flex items-center justify-center p-4">Loading...</div>}>
      <ProviderServiceSelection />
    </Suspense>
  );
}
