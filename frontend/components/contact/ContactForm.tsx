"use client";

import React, { useState } from 'react';
import { Send, CheckCircle, AlertCircle } from 'lucide-react';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import { API_URL } from '@/config/api';
// Force reload to fix Turbopack cache
import CelebrationModal from '@/components/common/CelebrationModal';

import { validateName, validateEmail, validatePhone } from "@/utils/validation";

const ContactForm = () => {
    const reveal = useScrollReveal(0.1);
    const [formState, setFormState] = useState({
        name: '',
        email: '',
        phone: '',
        subject: '',
        message: '',
    });

    const [isSubmitted, setIsSubmitted] = useState(false);

    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    const handleInputChange = (field: string, value: string) => {
        setFormState(prev => ({ ...prev, [field]: value }));
        if (fieldErrors[field]) {
            setFieldErrors(prev => ({ ...prev, [field]: "" }));
        }
        if (errorMsg) setErrorMsg("");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg("");
        const newErrors: Record<string, string> = {};

        const nameErr = validateName(formState.name);
        if (nameErr) newErrors.name = nameErr;

        const emailErr = validateEmail(formState.email);
        if (emailErr) newErrors.email = emailErr;

        if (formState.phone) {
            const phoneErr = validatePhone(formState.phone);
            if (phoneErr) newErrors.phone = phoneErr;
        }

        if (Object.keys(newErrors).length > 0) {
            setFieldErrors(newErrors);
            return;
        }
        setFieldErrors({});

        setIsLoading(true);

        try {
            const response = await fetch(`${API_URL}/contact`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formState),
            });

            let data: any = null;
            try {
                data = await response.json();
            } catch {
                // Non-JSON response fallback
            }

            if (!response.ok) {
                throw new Error(data?.message || 'Failed to submit inquiry. Please try again.');
            }

            setIsSubmitted(true);
            setFormState({ name: '', email: '', phone: '', subject: '', message: '' });
        } catch (error: any) {
            setErrorMsg(error.message || 'Failed to send message.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <div
                ref={reveal.ref}
                className={`scroll-hidden ${reveal.isVisible ? 'scroll-visible' : ''}`}
            >
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-blue-500/5 p-8 md:p-10 h-full flex flex-col">
                    <div className="flex-grow">
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-8 text-center">
                        Send a Message
                    </h2>

                    <form onSubmit={handleSubmit} className="space-y-5">
                            {/* Name Field */}
                            <div className="space-y-1.5">
                                <label htmlFor="contact-name" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                    Full Name
                                </label>
                                <input
                                    id="contact-name"
                                    type="text"
                                    required
                                    placeholder="e.g. John Doe"
                                    value={formState.name}
                                    onChange={(e) => handleInputChange('name', e.target.value)}
                                    className={`w-full px-5 py-3.5 bg-slate-50 border ${fieldErrors.name ? 'border-red-500 ring-2 ring-red-500/10' : 'border-slate-100'} rounded-2xl text-sm font-bold text-slate-900 placeholder-slate-300 focus:outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition-all`}
                                />
                                {fieldErrors.name && (
                                    <p className="text-xs text-red-500 font-semibold mt-1 flex items-center gap-1">
                                        <AlertCircle size={12} className="shrink-0" /> {fieldErrors.name}
                                    </p>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {/* Email Field */}
                                <div className="space-y-1.5">
                                    <label htmlFor="contact-email" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                        Email Address
                                    </label>
                                    <input
                                        id="contact-email"
                                        type="email"
                                        required
                                        placeholder="name@example.com"
                                        value={formState.email}
                                        onChange={(e) => handleInputChange('email', e.target.value)}
                                        className={`w-full px-5 py-3.5 bg-slate-50 border ${fieldErrors.email ? 'border-red-500 ring-2 ring-red-500/10' : 'border-slate-100'} rounded-2xl text-sm font-bold text-slate-900 placeholder-slate-300 focus:outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition-all`}
                                    />
                                    {fieldErrors.email && (
                                        <p className="text-xs text-red-500 font-semibold mt-1 flex items-center gap-1">
                                            <AlertCircle size={12} className="shrink-0" /> {fieldErrors.email}
                                        </p>
                                    )}
                                </div>

                                {/* Phone Field */}
                                <div className="space-y-1.5">
                                    <label htmlFor="contact-phone" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                        Phone Number
                                    </label>
                                    <input
                                        id="contact-phone"
                                        type="tel"
                                        required
                                        placeholder="+91 9876543210"
                                        value={formState.phone}
                                        onChange={(e) => handleInputChange('phone', e.target.value)}
                                        className={`w-full px-5 py-3.5 bg-slate-50 border ${fieldErrors.phone ? 'border-red-500 ring-2 ring-red-500/10' : 'border-slate-100'} rounded-2xl text-sm font-bold text-slate-900 placeholder-slate-300 focus:outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition-all`}
                                    />
                                    {fieldErrors.phone && (
                                        <p className="text-xs text-red-500 font-semibold mt-1 flex items-center gap-1">
                                            <AlertCircle size={12} className="shrink-0" /> {fieldErrors.phone}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Subject Field */}
                            <div className="space-y-1.5">
                                <label htmlFor="contact-subject" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                    Subject
                                </label>
                                <input
                                    id="contact-subject"
                                    type="text"
                                    required
                                    placeholder="How can we help you?"
                                    value={formState.subject}
                                    onChange={(e) => setFormState({ ...formState, subject: e.target.value })}
                                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-900 placeholder-slate-300 focus:outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition-all"
                                />
                            </div>

                            {/* Message Field */}
                            <div className="space-y-1.5">
                                <label htmlFor="contact-message" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                    Message
                                </label>
                                <textarea
                                    id="contact-message"
                                    required
                                    rows={4}
                                    placeholder="Tell us about your project..."
                                    value={formState.message}
                                    onChange={(e) => setFormState({ ...formState, message: e.target.value })}
                                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-900 placeholder-slate-300 focus:outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition-all resize-none"
                                />
                            </div>

                            {errorMsg && (
                                <p className="text-red-500 text-sm font-medium text-center">{errorMsg}</p>
                            )}

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full group relative inline-flex items-center justify-center gap-3 bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-8 py-4 rounded-2xl font-black text-[10px] tracking-widest uppercase shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-70 disabled:scale-100 transition-all duration-300"
                            >
                                <span>{isLoading ? 'SENDING...' : 'SUBMIT INQUIRY'}</span>
                                {!isLoading && <Send size={14} strokeWidth={2.5} className="group-hover:translate-x-1 transition-transform" />}
                            </button>
                        </form>
                    </div>

                    {/* Bottom Image to Fill All Remaining Space */}
                    <div className="relative overflow-hidden rounded-2xl min-h-[280px] flex-grow group">
                        <img
                            src="https://images.pexels.com/photos/34432794/pexels-photo-34432794.jpeg"
                            alt="Architectural detail"
                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-transparent pointer-events-none" />
                    </div>
                </div>
            </div>

            <CelebrationModal
                open={isSubmitted}
                onClose={() => setIsSubmitted(false)}
                title="Message Sent!"
                subtitle="Thank you for reaching out. We will get back to you within 24 hours."
                type="success"
            />
        </>
    );
};

export default ContactForm;
