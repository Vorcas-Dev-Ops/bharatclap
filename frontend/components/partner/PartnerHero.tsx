"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Users, Clock, DollarSign, Home, UserCircle, Store, PenTool, Scissors } from "lucide-react";
import { API_URL } from "@/config/api";

export function PartnerHero({ onRegisterClick }: { onRegisterClick: () => void }) {
    const defaultImages = [
        "https://images.unsplash.com/photo-1584820927498-cafe5c152771?q=80&w=400&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?q=80&w=400&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1504148455328-c376907d081c?q=80&w=400&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?q=80&w=400&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1600486913747-55e5470d6f40?q=80&w=400&auto=format&fit=crop"
    ];

    const [heroImages, setHeroImages] = useState<string[]>(defaultImages);

    // Fetch Images from DB
    useEffect(() => {
        const fetchImages = async () => {
            try {
                const [servicesRes, subservicesRes] = await Promise.all([
                    fetch(`${API_URL}/services`).catch(() => null),
                    fetch(`${API_URL}/sub-services`).catch(() => null)
                ]);

                let images: string[] = [];

                if (servicesRes && servicesRes.ok) {
                    const servicesData = await servicesRes.json();
                    if (Array.isArray(servicesData)) {
                        images = [...images, ...servicesData.map((s: any) => s.image).filter(Boolean)];
                    }
                }

                if (subservicesRes && subservicesRes.ok) {
                    const subservicesData = await subservicesRes.json();
                    if (Array.isArray(subservicesData)) {
                        images = [...images, ...subservicesData.map((s: any) => s.image).filter(Boolean)];
                    }
                }
                
                if (images.length >= 5) {
                    const uniqueImages = Array.from(new Set(images));
                    if (uniqueImages.length >= 5) {
                        const shuffled = uniqueImages.sort(() => 0.5 - Math.random());
                        setHeroImages([shuffled[0], shuffled[1], shuffled[2], shuffled[3], shuffled[4]]);
                    } else {
                        setHeroImages([...uniqueImages, ...defaultImages].slice(0, 5));
                    }
                }
            } catch (err) {
                console.error("Failed to fetch dynamic hero images", err);
            }
        };

        fetchImages();
    }, []);

    // Animate images moving left to right
    useEffect(() => {
        const interval = setInterval(() => {
            setHeroImages(prev => {
                const next = [...prev];
                const last = next.pop();
                if (last) next.unshift(last); // Move last to first (shift right visually across cards)
                return next;
            });
        }, 3000); // 3 seconds per shift
        
        return () => clearInterval(interval);
    }, []);

    return (
        <section className="relative overflow-hidden bg-[#0A102C] min-h-[90vh] flex flex-col justify-center pt-16 pb-8 px-4 lg:px-8">
            
            {/* Background Gradients */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#111A42] via-[#0A102C] to-[#040714] pointer-events-none -z-20" />
            
            {/* Glowing Floor Lines */}
            <div className="absolute bottom-0 left-0 w-[800px] h-[400px] -translate-x-1/4 translate-y-1/4 rounded-[50%] border-t border-l border-indigo-500/30 blur-[2px] opacity-70 pointer-events-none -z-10" style={{ transform: 'rotateX(60deg) rotateZ(45deg)' }} />
            <div className="absolute bottom-0 left-0 w-[1200px] h-[600px] -translate-x-1/3 translate-y-1/3 rounded-[50%] border-t-[2px] border-blue-600/20 blur-[3px] opacity-80 pointer-events-none -z-10" style={{ transform: 'rotateX(65deg) rotateZ(35deg)' }} />

            <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-8 z-10">
                
                {/* Left Side: 3D Image Cards Stack */}
                <div className="relative w-full lg:w-1/2 h-[470px] sm:h-[570px] flex items-center justify-center perspective-[2000px]">
                    
                    {/* Far Left Card */}
                    <motion.div 
                        initial={{ opacity: 0, x: -100 }}
                        animate={{ opacity: 0.4, x: 0 }}
                        transition={{ duration: 0.8, delay: 0.4 }}
                        className="absolute z-10 w-[170px] h-[275px] rounded-2xl overflow-hidden -translate-x-36 sm:-translate-x-48 border border-white/10 shadow-2xl bg-[#111A42]"
                    >
                        <div className="absolute inset-0 bg-blue-900/40 mix-blend-multiply z-10" />
                        <AnimatePresence mode="popLayout">
                            <motion.img 
                                key={heroImages[0]}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.5 }}
                                src={heroImages[0]} 
                                className="w-full h-full object-cover grayscale-[30%]" 
                                alt="Service" 
                            />
                        </AnimatePresence>
                        <div className="absolute bottom-3 left-3 bg-[#1E3A8A]/80 backdrop-blur-md p-1.5 rounded-[10px] border border-white/5 z-20">
                            <Home className="text-white w-4 h-4 opacity-70" />
                        </div>
                    </motion.div>
                    
                    {/* Mid Left Card */}
                    <motion.div 
                        initial={{ opacity: 0, x: -80 }}
                        animate={{ opacity: 0.7, x: 0 }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        className="absolute z-20 w-[210px] h-[355px] rounded-2xl overflow-hidden -translate-x-20 sm:-translate-x-28 border border-white/20 shadow-2xl bg-[#111A42]"
                    >
                        <div className="absolute inset-0 bg-blue-900/30 mix-blend-multiply z-10" />
                        <AnimatePresence mode="popLayout">
                            <motion.img 
                                key={heroImages[1]}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.5 }}
                                src={heroImages[1]} 
                                className="w-full h-full object-cover grayscale-[10%]" 
                                alt="Service" 
                            />
                        </AnimatePresence>
                        <div className="absolute bottom-4 left-4 bg-[#1E3A8A] backdrop-blur-md p-2 rounded-[12px] border border-white/10 z-20 shadow-lg">
                            <UserCircle className="text-white w-5 h-5 opacity-90" />
                        </div>
                    </motion.div>

                    {/* Far Right Card */}
                    <motion.div 
                        initial={{ opacity: 0, x: 100 }}
                        animate={{ opacity: 0.4, x: 0 }}
                        transition={{ duration: 0.8, delay: 0.4 }}
                        className="absolute z-10 w-[170px] h-[275px] rounded-2xl overflow-hidden translate-x-36 sm:translate-x-48 border border-white/10 shadow-2xl bg-[#111A42]"
                    >
                        <div className="absolute inset-0 bg-blue-900/40 mix-blend-multiply z-10" />
                        <AnimatePresence mode="popLayout">
                            <motion.img 
                                key={heroImages[2]}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.5 }}
                                src={heroImages[2]} 
                                className="w-full h-full object-cover grayscale-[30%]" 
                                alt="Service" 
                            />
                        </AnimatePresence>
                        <div className="absolute bottom-3 right-3 bg-[#1E3A8A]/80 backdrop-blur-md p-1.5 rounded-[10px] border border-white/5 z-20">
                            <Scissors className="text-white w-4 h-4 opacity-70" />
                        </div>
                    </motion.div>
                    
                    {/* Mid Right Card */}
                    <motion.div 
                        initial={{ opacity: 0, x: 80 }}
                        animate={{ opacity: 0.7, x: 0 }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        className="absolute z-20 w-[210px] h-[355px] rounded-2xl overflow-hidden translate-x-20 sm:translate-x-28 border border-white/20 shadow-2xl bg-[#111A42]"
                    >
                        <div className="absolute inset-0 bg-blue-900/30 mix-blend-multiply z-10" />
                        <AnimatePresence mode="popLayout">
                            <motion.img 
                                key={heroImages[3]}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.5 }}
                                src={heroImages[3]} 
                                className="w-full h-full object-cover grayscale-[10%]" 
                                alt="Service" 
                            />
                        </AnimatePresence>
                        <div className="absolute bottom-4 right-4 bg-[#1E3A8A] backdrop-blur-md p-2 rounded-[12px] border border-white/10 z-20 shadow-lg">
                            <PenTool className="text-white w-5 h-5 opacity-90" />
                        </div>
                    </motion.div>

                    {/* Center Focus Card */}
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                        className="absolute z-30 w-[275px] h-[440px] rounded-2xl overflow-hidden shadow-[0_0_80px_rgba(59,130,246,0.35)] border-[2.5px] border-[#3B82F6] bg-[#030712]"
                    >
                        <AnimatePresence mode="popLayout">
                            <motion.img 
                                key={heroImages[4]}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.5 }}
                                src={heroImages[4]} 
                                className="w-full h-full object-cover" 
                                alt="Main Partner" 
                            />
                        </AnimatePresence>
                        
                        {/* Glowing bottom gradient */}
                        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#0A102C]/90 via-[#0A102C]/40 to-transparent z-10" />
                        
                        <div className="absolute bottom-5 left-5 bg-[#173895] backdrop-blur-md p-3 rounded-xl border border-[#3B82F6]/50 z-20 shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
                            <Store className="text-white w-6 h-6" />
                        </div>
                    </motion.div>
                </div>

                {/* Right Side: Text Content & Stats */}
                <div className="w-full lg:w-1/2 flex flex-col items-center lg:items-start text-center lg:text-left z-20 mt-8 lg:mt-0 pl-0 lg:pl-10">
                    <motion.div
                        initial={{ opacity: 0, y: -16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <span className="inline-flex items-center rounded-full border border-blue-500/20 bg-[#111B44] px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-blue-300 mb-5 sm:mb-6">
                            Opportunity Awaits
                        </span>
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.55, delay: 0.1 }}
                        className="text-4xl lg:text-5xl font-extrabold text-white leading-[1.1] tracking-tight mb-4 sm:mb-5"
                    >
                        Earn More.<br />
                        <span className="text-[#60A5FA]">
                            Work on Your<br /> Schedule.
                        </span>
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.55, delay: 0.2 }}
                        className="text-sm text-blue-100/70 max-w-sm mb-6 sm:mb-8 leading-relaxed font-medium"
                    >
                        Join as a Service Partner and unlock a world of daily bookings, weekly payouts, and
                        complete flexibility.
                    </motion.p>

                    <motion.button
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.45, delay: 0.35 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={onRegisterClick}
                        className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-[10px] font-black uppercase tracking-widest text-[#0A102C] shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] transition-all mb-6"
                    >
                        Register Now <ArrowRight className="h-3 w-3" />
                    </motion.button>

                    {/* Stats Box moved here */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.55, delay: 0.5 }}
                        className="w-full max-w-md bg-[#0F173B]/70 backdrop-blur-lg border border-blue-400/20 rounded-2xl p-4 sm:p-5 shadow-[0_10px_40px_rgba(0,0,0,0.5)]"
                    >
                        <div className="grid grid-cols-3 gap-2 sm:gap-4 divide-x divide-white/10">
                            {[
                                { icon: Users, stat: "10K+", label: "Active" },
                                { icon: Clock, stat: "Flexible", label: "Hours" },
                                { icon: DollarSign, stat: "Weekly", label: "Payouts" },
                            ].map(({ icon: Icon, stat, label }, i) => (
                                <div key={i} className="flex flex-col items-center justify-center gap-1 px-2">
                                    <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-[#60A5FA] mb-1" />
                                    <span className="text-lg sm:text-xl font-extrabold text-white leading-none">{stat}</span>
                                    <span className="text-[8px] sm:text-[9px] text-blue-200/60 font-semibold uppercase tracking-widest">{label}</span>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
