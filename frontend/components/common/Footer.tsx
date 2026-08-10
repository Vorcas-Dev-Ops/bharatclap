"use client";

import React from "react";
import Link from "next/link";
import { ShieldCheck, Mail, PhoneCall, MapPin, Clock, FileText } from "lucide-react";
import {
  FacebookFilled,
  TwitterOutlined,
  InstagramOutlined,
  LinkedinFilled,
  YoutubeFilled,
} from "@ant-design/icons";
import { useSettings } from "@/context/SettingsContext";

const exploreLinks = [
  { name: "About Us", href: "/about" },
  { name: "Services & Categories", href: "/services" },
  { name: "Join as Partner", href: "/join-as-partner" },
  { name: "Contact Us", href: "/contact" },
];

const legalLinks = [
  { name: "Privacy Policy", href: "/privacy" },
  { name: "Terms & Conditions", href: "/terms" },
  { name: "Refund & Cancellation Policy", href: "/refund-policy" },
  { name: "Cookie Policy", href: "/cookies" },
];

const supportAndGuideLinks = [
  { name: "Help Center", href: "/help" },
  { name: "Support Center (Call Support 📞)", href: "/support" },
  { name: "Community Guidelines", href: "/community-guidelines" },
  { name: "Provider Guidelines", href: "/provider-guidelines" },
];

const Footer = () => {
  const {
    companyName,
    platformName,
    supportEmail,
    supportPhone,
    companyAddress,
    workingHours,
    gstNumber,
    appVersion,
    buildNumber,
    socialLinks,
  } = useSettings();

  const socialMap = [
    { icon: FacebookFilled, href: socialLinks?.facebook || "#", name: "Facebook" },
    { icon: TwitterOutlined, href: socialLinks?.twitter || "#", name: "Twitter" },
    { icon: InstagramOutlined, href: socialLinks?.instagram || "#", name: "Instagram" },
    { icon: LinkedinFilled, href: socialLinks?.linkedin || "#", name: "LinkedIn" },
    { icon: YoutubeFilled, href: socialLinks?.youtube || "#", name: "YouTube" },
  ];

  return (
    <footer className="bg-slate-900 text-slate-300 border-t border-slate-800 pt-12 sm:pt-16 pb-8 font-sans">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 sm:gap-8 lg:gap-12">
          
          {/* Logo & Brand Info */}
          <div className="space-y-4 text-center sm:text-left">
            <Link href="/" className="inline-block" aria-label={`${platformName} Home`}>
              <span className="text-2xl font-black text-white tracking-tight">
                {platformName}
              </span>
            </Link>
            <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto sm:mx-0 font-medium">
              India&apos;s trusted home services platform. Connecting verified professionals for home repairs, maintenance, and personal care at your doorstep.
            </p>
            <div className="flex items-center justify-center sm:justify-start gap-2 text-emerald-400">
              <ShieldCheck className="h-4 w-4" />
              <span className="text-[10px] font-bold uppercase tracking-widest">100% Verified Professionals</span>
            </div>
            
            {/* Social Links */}
            <div className="flex items-center justify-center sm:justify-start gap-2 pt-2">
              {socialMap.map((s, idx) => {
                const Icon = s.icon;
                return (
                  <a
                    key={idx}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.name}
                    className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white hover:bg-[#1D2B83] transition-all"
                  >
                    <Icon className="text-sm" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Legal Policies */}
          <div className="text-center sm:text-left">
            <h3 className="text-xs font-black uppercase tracking-widest text-white mb-4 underline decoration-[#1D2B83] decoration-2 underline-offset-4">
              Legal &amp; Trust
            </h3>
            <ul className="space-y-2.5">
              {legalLinks.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-xs font-semibold text-slate-400 hover:text-white transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Help & Support Links */}
          <div className="text-center sm:text-left">
            <h3 className="text-xs font-black uppercase tracking-widest text-white mb-4 underline decoration-[#1D2B83] decoration-2 underline-offset-4">
              Help &amp; Guidelines
            </h3>
            <ul className="space-y-2.5">
              {supportAndGuideLinks.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-xs font-semibold text-slate-400 hover:text-white transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Phone Support & Company Address */}
          <div className="text-center sm:text-left space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-white mb-2 underline decoration-[#1D2B83] decoration-2 underline-offset-4">
              Call Support
            </h3>
            
            <a
              href={`tel:${supportPhone.replace(/[^0-9+]/g, '')}`}
              aria-label={`Call ${platformName} Official Support`}
              className="p-3 bg-slate-800 hover:bg-slate-700 rounded-2xl border border-slate-700 flex items-center justify-center sm:justify-start gap-3 text-emerald-400 transition-all group"
            >
              <PhoneCall className="h-4 w-4 group-hover:scale-110 transition-transform flex-shrink-0" />
              <div className="text-left">
                <div className="text-xs font-black text-white">{supportPhone}</div>
                <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                  <Clock className="w-3 h-3 text-emerald-400" /> {workingHours}
                </div>
              </div>
            </a>

            <div className="text-xs text-slate-400 space-y-1.5">
              <p className="flex items-center justify-center sm:justify-start gap-1.5 text-slate-300 font-semibold">
                <Mail className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" /> {supportEmail}
              </p>
              <p className="flex items-start justify-center sm:justify-start gap-1.5 text-[11px] text-slate-400 leading-snug">
                <MapPin className="h-3.5 w-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                {companyAddress}
              </p>
              {gstNumber && (
                <p className="flex items-center justify-center sm:justify-start gap-1.5 text-[10px] text-slate-500 font-mono">
                  <FileText className="h-3 w-3 text-slate-500" /> GST: {gstNumber}
                </p>
              )}
            </div>
          </div>

        </div>

        {/* Bottom Bar with Dynamic Platform Version & Build Number */}
        <div className="border-t border-slate-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left text-[11px] font-medium text-slate-500">
          <div>
            © {new Date().getFullYear()} {companyName}. All rights reserved.
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-semibold">
            <Link href="/privacy" className="hover:text-slate-300">Privacy</Link>
            <span>•</span>
            <Link href="/terms" className="hover:text-slate-300">Terms</Link>
            <span>•</span>
            <Link href="/support" className="hover:text-slate-300">Call Support 📞</Link>
            <span className="px-2.5 py-0.5 bg-slate-800 text-blue-400 rounded-md font-mono text-[10px] border border-slate-700">
              v{appVersion} (build {buildNumber})
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
