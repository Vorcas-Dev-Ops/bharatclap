"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const navItems = [
  { label: "HOME", id: "home" },
  { label: "ABOUT US", id: "about" },
  { label: "SERVICES", id: "services" },
  { label: "CONTACT", id: "contact" },
  { label: "MY BOOKINGS", id: "bookings" },
];

const SegmentControl = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState("home");

  useEffect(() => {
    const handleScroll = () => {
      // Show after scrolling 100px
      if (window.scrollY > 100) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: -20, opacity: 0, x: "-50%" }}
          animate={{ y: 0, opacity: 1, x: "-50%" }}
          exit={{ y: -20, opacity: 0, x: "-50%" }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="fixed left-1/2 top-[4.5rem] z-40 -translate-x-1/2"
        >
          <div className="flex items-center gap-1 rounded-full bg-white p-1.5 shadow-2xl shadow-slate-200 border border-slate-100">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`relative px-6 py-2.5 text-[10px] font-bold tracking-widest transition-all duration-300 rounded-full ${
                  activeTab === item.id 
                    ? "text-white" 
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                {activeTab === item.id && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 z-0 rounded-full bg-[#1D2B83]"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10">{item.label}</span>
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SegmentControl;
