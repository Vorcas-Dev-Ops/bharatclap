"use client";

import React from 'react';
import { MapPin, Mail, Phone } from 'lucide-react';
import { useScrollReveal } from '@/hooks/useScrollReveal';

const contactDetails = [
    {
        icon: MapPin,
        label: 'OUR STUDIO',
        lines: ['482 Architectural Way, Suite 100', 'San Francisco, CA 94103'],
        color: 'from-indigo-500 to-purple-500',
    },
    {
        icon: Mail,
        label: 'INQUIRIES',
        lines: ['hello@architecturalservice.com'],
        color: 'from-blue-500 to-indigo-500',
    },
    {
        icon: Phone,
        label: 'DIRECT LINE',
        lines: ['+1 (415) 555-0192'],
        color: 'from-violet-500 to-fuchsia-500',
    },
];

const ContactInfo = () => {
    const reveal = useScrollReveal(0.1);

    return (
        <div
            ref={reveal.ref}
            className={`space-y-4 scroll-hidden ${reveal.isVisible ? 'scroll-visible' : ''}`}
        >
            {/* Separate Info Cards */}
            {contactDetails.map(({ icon: Icon, label, lines }) => (
                <div key={label} className="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-blue-500/5 p-6 transition-all duration-300 hover:shadow-blue-500/10 group flex items-start gap-6">
                    <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center transition-all duration-300 group-hover:bg-blue-600 group-hover:scale-110">
                        <Icon size={20} className="text-blue-600 transition-colors group-hover:text-white" strokeWidth={2.5} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-blue-600 tracking-widest uppercase mb-1">
                            {label}
                        </p>
                        {lines.map((line) => (
                            <p key={line} className="text-slate-600 text-sm font-bold leading-relaxed">
                                {line}
                            </p>
                        ))}
                    </div>
                </div>
            ))}

            {/* Architectural Gallery Grid */}
            <div className="grid grid-cols-2 gap-3 mt-2">
                {[
                    "https://images.pexels.com/photos/9461213/pexels-photo-9461213.jpeg",
                    "https://images.pexels.com/photos/18194839/pexels-photo-18194839.jpeg",
                    "https://images.pexels.com/photos/36842620/pexels-photo-36842620.jpeg",
                    "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=800&q=80&auto=format&fit=crop"
                ].map((src, idx) => (
                    <div key={idx} className="relative overflow-hidden rounded-3xl shadow-lg shadow-blue-500/5 group aspect-square">
                        <img
                            src={src}
                            alt={`Architecture detail ${idx + 1}`}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        {idx === 3 && (
                            <div className="absolute bottom-4 left-4 text-white">
                                <p className="text-[8px] font-black tracking-widest uppercase mb-0.5 opacity-80">Our Vision</p>
                                <p className="text-xs font-black tracking-tight">Curating Spaces.</p>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ContactInfo;
