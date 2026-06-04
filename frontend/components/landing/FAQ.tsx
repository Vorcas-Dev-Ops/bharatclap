"use client";

import React, { useState } from "react";
import { Plus, Minus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const faqs = [
  {
    question: "How does booking work?",
    answer: "Simply browse through our categories, select the service you need, choose your preferred slot, and confirm. A verified professional will be assigned to your request instantly.",
  },
  {
    question: "Is payment secure?",
    answer: "Absolutely. We use industry-standard encryption and secure payment gateways (Razorpay/Stripe) to ensure your transactions and data are protected at all times.",
  },
  {
    question: "What if service is delayed?",
    answer: "We value your time. If a professional is delayed beyond 30 minutes of the scheduled slot, we offer a 'Delay Compensation' discount or a free rescheduling option.",
  },
  {
    question: "How do loans work?",
    answer: "For high-value services, you can opt for 'Instant Service Loan' at checkout. This allows you to split your payment into 3, 6, or 12 easy monthly installments with 0% interest on eligible services.",
  },
];

const FAQ = () => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  return (
    <section className="bg-[#F5F2FB] py-12">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        
        {/* Section Heading */}
        <div className="text-center mb-20">
          <h2 className="text-3xl md:text-4xl font-bold text-[#171717]">
            Frequently Asked Questions
          </h2>
        </div>

        {/* FAQ List matches the requested clean card style */}
        <div className="flex flex-col gap-4 max-w-5xl mx-auto">
          {faqs.map((faq, index) => {
            const isActive = activeIndex === index;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="overflow-hidden rounded-2xl bg-white shadow-sm"
              >
                <button
                  onClick={() => setActiveIndex(isActive ? null : index)}
                  className="flex w-full items-center justify-between p-6 text-left"
                >
                  <span className="text-sm md:text-base font-bold text-[#1D2B83] tracking-tight">
                    {faq.question}
                  </span>
                  <div className="flex h-5 w-5 items-center justify-center text-[#1D2B83]">
                    {isActive ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  </div>
                </button>

                <AnimatePresence>
                  {isActive && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                    >
                      <div className="px-6 pb-6 pt-0">
                        <p className="text-xs md:text-sm text-slate-500 leading-relaxed font-medium">
                          {faq.answer}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FAQ;
