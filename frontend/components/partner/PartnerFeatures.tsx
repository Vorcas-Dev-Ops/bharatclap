"use client";

import React from "react";
import { motion } from "framer-motion";
import {
    GraduationCap,
    Sparkles,
    Scissors,
    Layers,
    CreditCard,
    Wind,
    Zap,
    Wrench,
    Paintbrush,
    Hammer,
    Bug,
    Settings,
    Heart,
    Dumbbell,
    Truck,
    Shirt,
    User,
    Upload,
    Shield,
    Award,
    TrendingUp,
    Calendar,
    DollarSign,
    Star,
    PhoneCall,
    MapPin,
    Clock
} from "lucide-react";
import { FadeIn } from "./FadeIn";

const WHO_CAN_JOIN = [
    { label: "Tutoring", icon: GraduationCap, color: "#FEF3C7", accent: "#D97706" },
    { label: "Cleaning", icon: Sparkles, color: "#EDE9FE", accent: "#8B5CF6" },
    { label: "Salon", icon: Scissors, color: "#FCE7F3", accent: "#EC4899" },
    { label: "Bulk Ordering", icon: Layers, color: "#DBEAFE", accent: "#3B82F6" },
    { label: "Loans / EMI", icon: CreditCard, color: "#D1FAE5", accent: "#10B981" },
    { label: "AC Repair", icon: Wind, color: "#DBEAFE", accent: "#3B82F6" },
    { label: "Electrical", icon: Zap, color: "#FFF3CD", accent: "#F59E0B" },
    { label: "Plumbing", icon: Wrench, color: "#D1FAE5", accent: "#10B981" },
    { label: "Painting", icon: Paintbrush, color: "#FCE7F3", accent: "#EC4899" },
    { label: "Carpentry", icon: Hammer, color: "#FEF3C7", accent: "#D97706" },
    { label: "Pest Control", icon: Bug, color: "#DCFCE7", accent: "#16A34A" },
    { label: "Appliance Repair", icon: Settings, color: "#E0F2FE", accent: "#0284C7" },
    { label: "Beauty & Spa", icon: Heart, color: "#FCE7F3", accent: "#DB2777" },
    { label: "Fitness", icon: Dumbbell, color: "#FEF3C7", accent: "#D97706" },
    { label: "Packers & Movers", icon: Truck, color: "#DBEAFE", accent: "#2563EB" },
    { label: "Laundry", icon: Shirt, color: "#EDE9FE", accent: "#7C3AED" },
];

const STEPS = [
    {
        title: "Sign Up",
        desc: "Create your free account with basic details in under 2 minutes.",
        icon: User,
    },
    {
        title: "Upload Documents",
        desc: "Submit your ID, address proof, and certifications securely.",
        icon: Upload,
    },
    {
        title: "Verification",
        desc: "Our team verifies your profile within 24–48 hours.",
        icon: Shield,
    },
    {
        title: "Training",
        desc: "Complete a quick onboarding session to get platform-ready.",
        icon: Award,
    },
    {
        title: "Start Working",
        desc: "Go live, accept bookings and start earning immediately.",
        icon: TrendingUp,
    },
];

const BENEFITS = [
    {
        icon: Calendar,
        title: "Flexible Schedule",
        desc: "Work on your own terms — pick hours that suit your lifestyle.",
        color: "#EDE9FE",
        accent: "#7C3AED",
    },
    {
        icon: DollarSign,
        title: "High Earnings",
        desc: "Earn up to ₹50,000/month with performance-based bonuses.",
        color: "#D1FAE5",
        accent: "#059669",
    },
    {
        icon: Star,
        title: "Regular Bookings",
        desc: "Get a steady stream of pre-vetted customer bookings.",
        color: "#DBEAFE",
        accent: "#2563EB",
    },
    {
        icon: PhoneCall,
        title: "24/7 Support",
        desc: "Our partner support team is always a call or chat away.",
        color: "#FCE7F3",
        accent: "#DB2777",
    },
];

const DOCUMENTS = [
    { label: "Government ID Proof", icon: User, desc: "Aadhaar / Passport / Voter ID" },
    { label: "Address Proof", icon: MapPin, desc: "Utility bill / Rental agreement" },
    { label: "Bank Details", icon: CreditCard, desc: "Account number & IFSC code" },
    { label: "Certifications", icon: Award, desc: "Trade / Skill / Degree certificates" },
];

const TESTIMONIALS = [
    {
        name: "Ramesh Kumar",
        role: "Electrician · Mumbai",
        rating: 5,
        review:
            "Joining was the best decision I made. I now earn 3x more than before, and the bookings keep coming. The platform is super easy to use.",
        initials: "RK",
        color: "#FFF3CD",
        accent: "#F59E0B",
    },
    {
        name: "Priya Sharma",
        role: "Beautician · Delhi",
        rating: 5,
        review:
            "I set my own hours, get paid weekly, and the support team always has my back. Couldn't ask for a better platform to grow my business.",
        initials: "PS",
        color: "#FCE7F3",
        accent: "#EC4899",
    },
    {
        name: "Arjun Nair",
        role: "AC Technician · Bengaluru",
        rating: 4,
        review:
            "Great flow of customers and transparent earnings. The training sessions helped me improve my skills too. Highly recommend!",
        initials: "AN",
        color: "#DBEAFE",
        accent: "#3B82F6",
    },
];

const MARQUEE_IMAGES = [
    "https://images.unsplash.com/photo-1581244277943-fe4a9c777189?auto=format&fit=crop&q=80&w=600",
    "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&q=80&w=600",
    "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&q=80&w=600",
    "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&q=80&w=600",
    "https://images.unsplash.com/photo-1540569014015-19a7be504e3a?auto=format&fit=crop&q=80&w=600",
    "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&q=80&w=600"
];

export function PartnerFeatures() {
    return (
        <>


            {/* WHO CAN JOIN */}
            <section className="py-24 px-4">
                <div className="mx-auto max-w-6xl">
                    <FadeIn className="text-center mb-14">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#1D2B83]">
                            Who Can Join
                        </span>
                        <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-slate-900">
                            We&apos;re Looking for Skilled Professionals
                        </h2>
                        <p className="mt-4 text-slate-500 max-w-xl mx-auto">
                            Whether you&apos;re a seasoned electrician or a passionate tutor, there&apos;s a place for you on
                            our platform.
                        </p>
                    </FadeIn>

                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                        {WHO_CAN_JOIN.map(({ label, icon: Icon, color, accent }, i) => (
                            <FadeIn key={i} delay={i * 0.07}>
                                <motion.div
                                    whileHover={{ scale: 1.06, y: -6 }}
                                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                    className="group aspect-square flex flex-col items-center justify-between rounded-2xl bg-white border border-slate-100 shadow-soft p-4 cursor-pointer hover:shadow-lg transition-shadow duration-300"
                                >
                                    <div className="flex-1 flex items-center justify-center w-full">
                                        <div
                                            className="flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110"
                                            style={{ backgroundColor: color }}
                                        >
                                            <Icon className="h-5 w-5" style={{ color: accent }} />
                                        </div>
                                    </div>
                                    <span className="text-center text-[9px] font-bold text-slate-700 uppercase tracking-wider leading-tight">
                                        {label}
                                    </span>
                                </motion.div>
                            </FadeIn>
                        ))}
                    </div>
                </div>
            </section>

            {/* HOW IT WORKS */}
            <section className="py-24 px-4 bg-white">
                <div className="mx-auto max-w-6xl">
                    <FadeIn className="text-center mb-16">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#1D2B83]">
                            How It Works
                        </span>
                        <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-slate-900">
                            5 Simple Steps to Get Started
                        </h2>
                    </FadeIn>

                    <div className="relative">
                        <div className="absolute top-10 left-0 right-0 h-0.5 bg-slate-200 hidden lg:block" />
                        <div className="grid grid-cols-1 sm:grid-cols-5 gap-8 lg:gap-4">
                            {STEPS.map(({ title, desc, icon: Icon }, i) => (
                                <FadeIn key={i} delay={i * 0.1}>
                                    <div className="relative flex flex-col items-center text-center gap-4">
                                        <motion.div
                                            whileHover={{ scale: 1.1 }}
                                            className="relative z-10 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#1D2B83] to-[#3b4fc0] shadow-md"
                                        >
                                            <Icon className="h-8 w-8 text-white" />
                                            <div className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-white border-2 border-[#1D2B83] text-[10px] font-bold text-[#1D2B83]">
                                                {i + 1}
                                            </div>
                                        </motion.div>
                                        <h3 className="font-bold text-slate-900">{title}</h3>
                                        <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
                                    </div>
                                </FadeIn>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* BENEFITS */}
            <section className="py-24 px-4">
                <div className="mx-auto max-w-6xl">
                    <FadeIn className="text-center mb-14">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#1D2B83]">
                            Partner Benefits
                        </span>
                        <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-slate-900">
                            Why Partner With Us?
                        </h2>
                    </FadeIn>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {BENEFITS.map(({ icon: Icon, title, desc, color, accent }, i) => (
                            <FadeIn key={i} delay={i * 0.08}>
                                <motion.div
                                    whileHover={{ y: -6, scale: 1.02 }}
                                    transition={{ type: "spring", stiffness: 280, damping: 20 }}
                                    className="group rounded-3xl bg-white border border-slate-100 shadow-soft p-8 flex flex-col gap-5 cursor-pointer hover:shadow-lg transition-shadow"
                                >
                                    <div
                                        className="flex h-14 w-14 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110"
                                        style={{ backgroundColor: color }}
                                    >
                                        <Icon className="h-7 w-7" style={{ color: accent }} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-900 mb-1">{title}</h3>
                                        <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
                                    </div>
                                </motion.div>
                            </FadeIn>
                        ))}
                    </div>
                </div>
            </section>
            {/* AUTO-SCROLL MARQUEE SECTION */}
            <section className="py-12 bg-white overflow-hidden border-b border-slate-100">
                <style dangerouslySetInnerHTML={{
                    __html: `
                    @keyframes scroll {
                        0% { transform: translateX(0); }
                        100% { transform: translateX(calc(-250px * 6 - 1.5rem * 6)); }
                    }
                    .animate-scroll {
                        animation: scroll 20s linear infinite;
                    }
                    .animate-scroll:hover {
                        animation-play-state: paused;
                    }
                `}} />
                <div className="mx-auto max-w-7xl px-4 text-center mb-8">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#1D2B83]">
                        Our Partners in Action
                    </span>
                </div>
                <div className="relative flex w-full overflow-hidden">
                    <div className="flex animate-scroll gap-6 w-max">
                        {/* First set of images */}
                        {MARQUEE_IMAGES.map((src, i) => (
                            <div key={`img1-${i}`} className="w-[250px] h-[180px] sm:w-[320px] sm:h-[220px] rounded-2xl overflow-hidden shrink-0 shadow-sm border border-slate-100">
                                <img src={src} alt={`Partner Service ${i}`} className="w-full h-full object-cover hover:scale-110 transition-transform duration-700" />
                            </div>
                        ))}
                        {/* Duplicate set for infinite scroll effect */}
                        {MARQUEE_IMAGES.map((src, i) => (
                            <div key={`img2-${i}`} className="w-[250px] h-[180px] sm:w-[320px] sm:h-[220px] rounded-2xl overflow-hidden shrink-0 shadow-sm border border-slate-100">
                                <img src={src} alt={`Partner Service ${i}`} className="w-full h-full object-cover hover:scale-110 transition-transform duration-700" />
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* DOCUMENTS */}
            <section className="py-24 px-4">
                <div className="mx-auto max-w-5xl">
                    <FadeIn className="text-center mb-14">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#1D2B83]">
                            Documents Required
                        </span>
                        <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-slate-900">
                            What You&apos;ll Need to Provide
                        </h2>
                    </FadeIn>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                        {DOCUMENTS.map(({ label, icon: Icon, desc }, i) => (
                            <FadeIn key={i} delay={i * 0.08}>
                                <div className="flex flex-col gap-4 rounded-3xl bg-white border border-slate-100 shadow-soft p-7">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-[#1D2B83]">
                                        <Icon className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-900 mb-1">{label}</h3>
                                        <p className="text-[11px] text-slate-400 font-medium">{desc}</p>
                                    </div>
                                </div>
                            </FadeIn>
                        ))}
                    </div>
                </div>
            </section>

            {/* TESTIMONIALS */}
            <section className="py-24 px-4 bg-white">
                <div className="mx-auto max-w-6xl">
                    <FadeIn className="text-center mb-16">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#1D2B83]">
                            Partner Stories
                        </span>
                        <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-slate-900">
                            Hear from Our Successful Partners
                        </h2>
                    </FadeIn>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {TESTIMONIALS.map(({ name, role, review, initials, color, accent }, i) => (
                            <FadeIn key={i} delay={i * 0.1}>
                                <div className="flex flex-col h-full rounded-3xl bg-slate-50 p-8 shadow-sm border border-slate-100">
                                    <div className="flex items-center gap-4 mb-6">
                                        <div
                                            className="flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold"
                                            style={{ backgroundColor: color, color: accent }}
                                        >
                                            {initials}
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-slate-900">{name}</h4>
                                            <p className="text-[11px] text-slate-500 font-medium">{role}</p>
                                        </div>
                                    </div>
                                    <p className="text-sm text-slate-600 leading-relaxed italic grow">
                                        &ldquo;{review}&rdquo;
                                    </p>
                                    <div className="flex gap-1 mt-6">
                                        {[1, 2, 3, 4, 5].map((s) => (
                                            <Star key={s} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                        ))}
                                    </div>
                                </div>
                            </FadeIn>
                        ))}
                    </div>
                </div>
            </section>
        </>
    );
}
