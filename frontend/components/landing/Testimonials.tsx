"use client";

import React from "react";
import { Rate, Avatar } from "antd";
import { motion } from "framer-motion";

const testimonials = [
  {
    id: 1,
    name: "Sarah Jenkins",
    role: "Home Owner",
    feedback: "The AC repair service was exceptional. The technician arrived on time and explained everything clearly. Truly professional!",
    rating: 5,
    avatar: "https://i.pravatar.cc/150?u=sarah",
  },
  {
    id: 2,
    name: "Michael Chen",
    role: "Architect",
    feedback: "Best deep cleaning service I've ever used. My house feels brand new. The attention to detail was unbelievable.",
    rating: 5,
    avatar: "https://i.pravatar.cc/150?u=michael",
  },
  {
    id: 3,
    name: "Elena Rodriguez",
    role: "Marketing Manager",
    feedback: "Finding a reliable math tutor for my son was so easy. Within hours we were matched with an expert. Amazing platform!",
    rating: 5,
    avatar: "https://i.pravatar.cc/150?u=elena",
  },
];

const Testimonials = () => {
  return (
    <section className="bg-[#FAFBFF] py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-16 text-center">
          <h2 className="text-4xl font-bold text-slate-900">What our homeowners say</h2>
          <p className="mt-4 text-lg text-slate-600">Join thousands of happy customers who trust us with their homes.</p>
        </div>

        <div className="relative overflow-hidden pt-4 pb-8">
          <div className="pointer-events-none absolute inset-y-0 left-0 w-16 md:w-32 bg-gradient-to-r from-[#FCF8FF] to-transparent z-10" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-16 md:w-32 bg-gradient-to-l from-[#FCF8FF] to-transparent z-10" />

          <motion.div
            className="flex gap-8 w-max"
            animate={{ x: ["0%", "-50%"] }}
            transition={{ ease: "linear", duration: 25, repeat: Infinity }}
          >
            {[...testimonials, ...testimonials, ...testimonials, ...testimonials].map((t, index) => (
              <div
                key={`${t.id}-${index}`}
                className="w-[320px] md:w-[400px] flex-shrink-0 flex flex-col rounded-3xl bg-white hover:bg-[#F5F7FB] p-8 shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all duration-300 border border-slate-100 hover:border-indigo-100"
              >
                <Rate disabled defaultValue={t.rating} className="mb-6 text-sm text-yellow-400" />
                <p className="mb-8 flex-grow text-slate-600 italic">"{t.feedback}"</p>
                <div className="flex items-center gap-4">
                  <Avatar src={t.avatar} size={48} className="border-2 border-slate-100" />
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{t.name}</h4>
                    <p className="text-xs text-slate-500">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
