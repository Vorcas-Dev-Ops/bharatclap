"use client";

import React from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Mail,
  Phone
} from "lucide-react";
import {
  FacebookFilled,
  TwitterOutlined,
  InstagramOutlined,
  LinkedinFilled,
  YoutubeFilled
} from "@ant-design/icons";

const links = [
  { name: "About", href: "/about" },
  { name: "Services", href: "/services" },
  { name: "Contact", href: "/contact" },
  { name: "Privacy Policy", href: "/privacy" },
  { name: "Terms", href: "/terms" },
];

const socialLinks = [
  { icon: FacebookFilled, href: "#" },
  { icon: TwitterOutlined, href: "#" },
  { icon: InstagramOutlined, href: "#" },
  { icon: LinkedinFilled, href: "#" },
  { icon: YoutubeFilled, href: "#" },
];

const Footer = () => {
  return (
    <footer className="bg-slate-50 border-t border-slate-200 pt-12 sm:pt-16 pb-6 sm:pb-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 sm:gap-8 lg:gap-16">

          {/* Logo & Info column */}
          <div className="space-y-4 text-center sm:text-left">
            <Link href="/" className="inline-block">
              <span className="text-2xl font-black text-[#1D2B83] tracking-tight">
                FIXVO
              </span>
            </Link>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed max-w-xs mx-auto sm:mx-0 font-medium">
              Your one-stop destination for premium home services. From repairs to renovations, we bring the professionals to you.
            </p>
            <div className="flex items-center justify-center sm:justify-start gap-2 text-[#1D2B83]">
              <ShieldCheck className="h-4 w-4" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Verified Solutions</span>
            </div>
          </div>

          {/* Quick Links column */}
          <div className="text-center sm:text-left">
            <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-900 mb-4 sm:mb-6 underline decoration-[#1D2B83] decoration-2 underline-offset-4">
              Explore
            </h4>
            <ul className="space-y-3">
              {links.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-xs sm:text-sm font-semibold text-slate-500 hover:text-[#1D2B83] transition-colors inline-block"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support / Contact info */}
          <div className="text-center sm:text-left">
            <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-900 mb-4 sm:mb-6 underline decoration-[#1D2B83] decoration-2 underline-offset-4">
              Support
            </h4>
            <div className="space-y-4 max-w-xs mx-auto sm:mx-0">
              <div className="flex items-center justify-center sm:justify-start gap-3 group cursor-pointer">
                <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-sm group-hover:border-[#1D2B83] transition-all flex-shrink-0">
                  <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#1D2B83]" />
                </div>
                <span className="text-[11px] sm:text-xs font-semibold text-slate-500 group-hover:text-slate-800 transition-colors truncate">support@fixvo.com</span>
              </div>
              <div className="flex items-center justify-center sm:justify-start gap-3 group cursor-pointer">
                <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-sm group-hover:border-[#1D2B83] transition-all flex-shrink-0">
                  <Phone className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#1D2B83]" />
                </div>
                <span className="text-[11px] sm:text-xs font-semibold text-slate-500 group-hover:text-slate-800 transition-colors">+1 (800) 123-4567</span>
              </div>
            </div>
          </div>

          {/* Social column */}
          <div className="text-center sm:text-left">
            <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-900 mb-4 sm:mb-6 underline decoration-[#1D2B83] decoration-2 underline-offset-4">
              Follow Us
            </h4>
            <div className="flex flex-wrap justify-center sm:justify-start gap-3">
              {socialLinks.map((social, i) => {
                const Icon = social.icon;
                return (
                  <Link
                    key={i}
                    href={social.href}
                    className="h-10 w-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-white hover:bg-[#1D2B83] hover:border-[#1D2B83] transition-all shadow-sm group"
                  >
                    <Icon className="h-4 w-4 transition-transform group-hover:scale-110" />
                  </Link>
                );
              })}
            </div>
          </div>

        </div>

        <div className="mt-12 sm:mt-16 border-t border-slate-100 pt-6 text-center text-[10px] sm:text-[11px] font-medium text-slate-400">
          © 2026 FIXVO. Service with Trust.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
