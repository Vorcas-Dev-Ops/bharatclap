"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AccessoriesRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // All onboarding including accessories selection has been unified into the Kit page
    router.replace("/provider/onboarding/kit");
  }, [router]);

  return (
    <div className="flex justify-center items-center h-[70vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#1D2B83]"></div>
        <p className="text-slate-500 font-medium text-sm">
          Redirecting to Provider Kit setup...
        </p>
      </div>
    </div>
  );
}
