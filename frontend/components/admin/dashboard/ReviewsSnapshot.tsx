"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Star, MessageSquareQuote } from 'lucide-react';

const ReviewsSnapshot: React.FC = () => {
   const reviews = [
      { user: 'Sumanth B', rating: 5, comment: 'Excellent prompt service for AC repair. Highly recommend!', provider: 'Arjun Verma' },
      { user: 'Ananya R', rating: 4, comment: 'Cleaning was very thorough, but took longer than expected.', provider: 'Sneha Kapur' },
      { user: 'Rohit K', rating: 5, comment: 'Punctual and professional electrician. Fixed the issue in 10 mins.', provider: 'Ritesh Kumar' },
   ];

   return (
      <div className="flex flex-col h-full bg-white/40 backdrop-blur-xl border border-white/60 p-6 rounded-2xl shadow-sm relative z-10">
         <div className="flex items-center justify-between mb-8">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest">Recent Reviews</h2>
            <div className="flex items-center gap-2 group cursor-pointer text-blue-600">
               <span className="text-[10px] font-black uppercase tracking-widest">View Analytics</span>
               <MessageSquareQuote size={14} className="group-hover:rotate-12 transition-transform" />
            </div>
         </div>

         <div className="space-y-6">
            {reviews.map((rev, i) => (
               <div key={i} className="flex gap-4 group cursor-pointer border-b border-white/20 pb-4 last:border-0 hover:bg-white/20 transition-all p-2 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-black text-blue-600 text-xs shrink-0 group-hover:scale-110 transition-transform">
                     {rev.user[0]}
                  </div>
                  <div className="flex-1 space-y-2">
                     <div className="flex justify-between items-center text-[11px] font-bold">
                        <span className="text-gray-900">{rev.user}</span>
                        <div className="flex items-center text-orange-500">
                           <Star size={10} fill="currentColor" />
                           <span className="ml-1">{rev.rating}</span>
                        </div>
                     </div>
                     <p className="text-[10px] text-gray-500 italic leading-relaxed font-medium">"{rev.comment}"</p>
                     <div className="flex items-center gap-2 text-[9px]">
                        <span className="font-bold text-blue-600 uppercase tracking-wide">Service By:</span>
                        <span className="text-gray-700 font-black">{rev.provider}</span>
                     </div>
                  </div>
               </div>
            ))}
         </div>
      </div>
   );
};

export default ReviewsSnapshot;
