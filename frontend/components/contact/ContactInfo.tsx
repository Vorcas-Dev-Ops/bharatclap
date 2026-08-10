"use client";

import React from 'react';
import { MapPin, Mail, Phone, Clock, ShieldCheck, AlertCircle } from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';

const ContactInfo = () => {
  const {
    companyName,
    platformName,
    supportEmail,
    businessEmail,
    supportPhone,
    companyAddress,
    workingHours,
    emergencyContact,
    supportStatus,
  } = useSettings();

  const contactDetails = [
    {
      icon: Phone,
      label: 'OFFICIAL HELPLINE (PRIMARY)',
      lines: [supportPhone, `Status: ${supportStatus.badge} (${supportStatus.expectedResponseTime})`],
      href: `tel:${supportPhone.replace(/[^0-9+]/g, '')}`,
      highlight: true,
    },
    {
      icon: Clock,
      label: 'OPERATING HOURS',
      lines: ['Support Desk Active:', workingHours],
    },
    {
      icon: Mail,
      label: 'EMAIL INQUIRIES',
      lines: [`Customer Support: ${supportEmail}`, `Business Partnerships: ${businessEmail}`],
    },
    {
      icon: MapPin,
      label: 'HEADQUARTERS ADDRESS',
      lines: [companyName, companyAddress],
    },
  ];

  return (
    <div className="space-y-4 font-sans">
      {contactDetails.map(({ icon: Icon, label, lines, href, highlight }) => (
        <div
          key={label}
          className={`p-6 rounded-3xl border transition-all flex items-start gap-5 ${
            highlight
              ? 'bg-gradient-to-r from-blue-50 to-emerald-50 border-blue-200 shadow-md'
              : 'bg-white border-slate-200/80 shadow-sm'
          }`}
        >
          <div
            className={`flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center ${
              highlight ? 'bg-[#1D2B83] text-white shadow-md' : 'bg-blue-50 text-[#1D2B83]'
            }`}
          >
            <Icon size={22} strokeWidth={2.2} />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-black text-blue-600 tracking-widest uppercase mb-1">
              {label}
            </p>
            {lines.map((line) => (
              <p key={line} className="text-slate-800 text-sm font-bold leading-relaxed">
                {line}
              </p>
            ))}
            {href && (
              <a
                href={href}
                className="inline-block mt-2 text-xs font-black text-emerald-600 underline hover:text-emerald-700"
              >
                Call Support Now →
              </a>
            )}
          </div>
        </div>
      ))}

      {/* Emergency Escalation */}
      <div className="p-6 bg-slate-900 rounded-3xl text-white space-y-2">
        <div className="flex items-center gap-2 text-emerald-400 text-xs font-black uppercase tracking-wider">
          <ShieldCheck className="w-4 h-4" /> Emergency Escalation &amp; On-Site Safety
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          For urgent on-site safety issues or provider conduct escalations during active service execution on {platformName}, dial <code>{emergencyContact}</code> immediately for emergency team dispatch.
        </p>
      </div>
    </div>
  );
};

export default ContactInfo;
