"use client";

import React from "react";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "antd";

export default function EmptyCart() {
  return (
    <div className="min-h-[60vh] bg-white flex flex-col items-center justify-center p-6 text-center rounded-[2rem] shadow-sm border border-slate-100">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md"
      >
        <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6">
          <Plus className="w-10 h-10 text-slate-300" />
        </div>
        <h2 className="text-2xl font-black text-slate-800 mb-2">Your cart is empty</h2>
        <p className="text-slate-400 font-medium mb-8">Looks like you haven't added any services yet. Let's find something for you!</p>
        <Link href="/services">
          <Button type="primary" size="large" className="h-14 px-10 bg-[#1D2B83] rounded-2xl font-bold border-none shadow-xl shadow-blue-900/20">
            Browse Services
          </Button>
        </Link>
      </motion.div>
    </div>
  );
}
