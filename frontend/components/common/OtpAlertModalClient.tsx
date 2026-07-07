"use client";

import dynamic from "next/dynamic";

// Must live in a Client Component — ssr:false is not allowed in Server Components
const OtpAlertModal = dynamic(() => import("./OtpAlertModal"), { ssr: false });

export default function OtpAlertModalClient() {
  return <OtpAlertModal />;
}
