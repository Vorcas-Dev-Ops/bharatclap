"use client";

import React, { useState, useEffect } from "react";
import { WifiOff, Wifi } from "lucide-react";

export const NetworkStatusBanner: React.FC = () => {
  const [isOffline, setIsOffline] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOffline = () => {
      setIsOffline(true);
      setWasOffline(true);
    };

    const handleOnline = () => {
      setIsOffline(false);
      // Auto-dismiss reconnected banner after 3 seconds
      setTimeout(() => setWasOffline(false), 3000);
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    if (!navigator.onLine) {
      setIsOffline(true);
      setWasOffline(true);
    }

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  if (!isOffline && !wasOffline) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[9999] py-2 px-4 text-center text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 shadow-md ${
        isOffline
          ? "bg-rose-600 text-white animate-pulse"
          : "bg-emerald-600 text-white"
      }`}
    >
      {isOffline ? (
        <>
          <WifiOff size={14} className="animate-bounce" />
          <span>Connection Lost · Retrying automatically when online...</span>
        </>
      ) : (
        <>
          <Wifi size={14} />
          <span>Back Online · Connection Restored</span>
        </>
      )}
    </div>
  );
};

export default NetworkStatusBanner;
