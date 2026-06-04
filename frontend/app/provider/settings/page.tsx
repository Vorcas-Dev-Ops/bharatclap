"use client";

import React, { useState } from "react";
import ProviderLayout from "@/components/provider/ProviderLayout";
import { 
  Settings, 
  Bell, 
  Shield, 
  ToggleRight, 
  ToggleLeft as Toggle, 
  ChevronRight, 
  LogOut, 
  Smartphone,
  Globe,
  Trash2,
  Lock,
  Zap,
  Check
} from "lucide-react";

export default function SettingsPage() {
  const [onlineStatus, setOnlineStatus] = useState(true);

  const sections = [
    {
      title: "Account Preferences",
      items: [
        { name: "Global Notifications", desc: "Receive alerts for all activities", icon: Bell, type: "toggle", value: true },
        { name: "Language", desc: "English (US)", icon: Globe, type: "link" },
        { name: "App Appearance", desc: "System (Light)", icon: Smartphone, type: "link" },
      ]
    },
    {
      title: "Security & Privacy",
      items: [
        { name: "Password & Security", desc: "Update your password and 2FA", icon: Lock, type: "link" },
        { name: "Privacy Policy", desc: "How we manage your data", icon: Shield, type: "link" },
      ]
    }
  ];

  return (
    <ProviderLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Account Settings</h1>
            <p className="text-slate-500 font-medium">Manage your app experience and security preferences.</p>
          </div>
          <div className={`flex items-center gap-4 px-6 py-3 rounded-2xl border transition-all ${
            onlineStatus ? "bg-emerald-50 border-emerald-100" : "bg-slate-50 border-slate-200"
          }`}>
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Store Status</span>
              <span className={`text-sm font-black ${onlineStatus ? "text-emerald-600" : "text-slate-500"}`}>
                {onlineStatus ? "Online" : "Offline"}
              </span>
            </div>
            <button onClick={() => setOnlineStatus(!onlineStatus)}>
              {onlineStatus ? (
                <ToggleRight className="h-10 w-10 text-emerald-500" />
              ) : (
                <Toggle className="h-10 w-10 text-slate-300" />
              )}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {sections.map((section) => (
              <div key={section.title} className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-8 py-6 bg-slate-50/50 border-b border-slate-50">
                  <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">{section.title}</h2>
                </div>
                <div className="divide-y divide-slate-50">
                  {section.items.map((item) => (
                    <div key={item.name} className="p-8 flex items-center justify-between hover:bg-slate-50/50 transition-all cursor-pointer group">
                      <div className="flex items-center gap-6">
                        <div className="p-3 bg-slate-50 text-slate-400 group-hover:bg-primary/10 group-hover:text-primary rounded-2xl transition-all">
                          <item.icon className="h-6 w-6" />
                        </div>
                        <div>
                          <h3 className="text-base font-black text-slate-900">{item.name}</h3>
                          <p className="text-sm font-medium text-slate-400">{item.desc}</p>
                        </div>
                      </div>
                      {item.type === "toggle" ? (
                        <button>
                           {item.value ? <ToggleRight className="h-10 w-10 text-primary" /> : <Toggle className="h-10 w-10 text-slate-200" />}
                        </button>
                      ) : (
                        <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-slate-600 transition-all" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="bg-rose-50 p-8 rounded-[40px] border border-rose-100 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="p-3 bg-rose-500 text-white rounded-2xl shadow-lg shadow-rose-100">
                  <Trash2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-rose-900">Delete Account</h3>
                  <p className="text-sm font-medium text-rose-500/80">Permanently remove your account and data.</p>
                </div>
              </div>
              <button className="px-6 py-3 border border-rose-200 text-rose-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-rose-100 transition-all">
                Delete
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-primary rounded-[40px] p-8 text-white shadow-xl shadow-primary/20 flex flex-col gap-8">
              <div className="h-14 w-14 bg-white/20 rounded-2xl flex items-center justify-center">
                <Zap className="h-8 w-8 text-primary/40" />
              </div>
              <div>
                <h3 className="text-xl font-black mb-2 leading-tight">Professional Subscription</h3>
                <p className="text-primary/70 text-sm font-medium leading-relaxed">
                  Upgrade to unlock premium features and lower commission rates.
                </p>
              </div>
              <button className="w-full py-4 bg-white text-primary rounded-2xl font-black text-sm hover:bg-primary/5 transition-all">
                Upgrade Now
              </button>
            </div>

            <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm flex flex-col gap-6">
              <h3 className="text-lg font-black text-slate-900">Connected Devices</h3>
              <div className="space-y-4">
                {[
                  { device: "iPhone 15 Pro", location: "New Delhi", active: true },
                  { device: "MacBook Air", location: "Gurgaon", active: false }
                ].map((d, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div>
                      <span className="block text-sm font-bold text-slate-900">{d.device}</span>
                      <span className="block text-xs font-medium text-slate-400">{d.location}</span>
                    </div>
                    {d.active ? (
                      <span className="text-[10px] font-black text-emerald-600 uppercase flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        This Device
                      </span>
                    ) : (
                      <button className="text-[10px] font-black text-rose-500 uppercase">Remove</button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <button className="w-full flex items-center justify-center gap-3 py-5 bg-white border border-slate-200 text-rose-600 rounded-[32px] font-black text-sm uppercase tracking-widest hover:bg-rose-50 transition-all group">
              <LogOut className="h-5 w-5 group-hover:-translate-x-1 transition-transform" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </ProviderLayout>
  );
}
