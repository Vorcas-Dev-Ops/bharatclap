"use client";

import React, { useState } from 'react';
import { Clock, MapPin, Calendar, Power, Coffee, Sun } from 'lucide-react';

export default function ProviderAvailabilityPage() {
  const [status, setStatus] = useState<'available' | 'offline' | 'break' | 'vacation'>('available');
  const [workingRadius, setWorkingRadius] = useState<number>(15);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Availability & Working Radius</h1>
          <p className="text-xs text-gray-500 font-medium">Manage Shift Schedule, Working Radius, Break Mode, and Vacation Schedules</p>
        </div>
      </div>

      <div className="bg-white/60 backdrop-blur-xl border border-white/60 rounded-2xl p-6 shadow-sm space-y-6">
        <div>
          <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3">Live Status Selection</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { id: 'available', label: 'Online / Available', color: 'bg-emerald-600 text-white' },
              { id: 'offline', label: 'Offline', color: 'bg-gray-700 text-white' },
              { id: 'break', label: 'On Break', color: 'bg-amber-600 text-white' },
              { id: 'vacation', label: 'Vacation Mode', color: 'bg-purple-600 text-white' }
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setStatus(item.id as any)}
                className={`p-3 rounded-xl text-xs font-bold transition-all border shadow-sm ${
                  status === item.id ? `${item.color} border-transparent shadow-md scale-[1.02]` : 'bg-white/80 text-gray-700 hover:bg-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2 pt-4 border-t border-gray-100">
          <label className="text-xs font-bold text-gray-900 flex items-center gap-2">
            <MapPin size={14} className="text-blue-600" />
            Working Service Radius: <span className="text-blue-600 font-black">{workingRadius} km</span>
          </label>
          <input
            type="range"
            min="5"
            max="50"
            value={workingRadius}
            onChange={(e) => setWorkingRadius(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <p className="text-[10px] text-gray-400">Dispatch engine will only match jobs within {workingRadius} km of your location.</p>
        </div>
      </div>
    </div>
  );
}
