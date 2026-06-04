"use client";

import React from 'react';
import { LucideIcon } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: LucideIcon;
  helperText?: string;
}

const Input: React.FC<InputProps> = ({ 
  label, 
  error, 
  icon: Icon, 
  helperText, 
  className = '', 
  ...props 
}) => {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label className="text-sm font-semibold text-gray-700 tracking-tight">
          {label}
        </label>
      )}
      <div className="relative group/input">
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within/input:text-blue-500 transition-colors duration-200">
            <Icon size={18} />
          </div>
        )}
        <input
          className={`w-full ${Icon ? 'pl-10' : 'px-4'} pr-4 py-2.5 bg-white border border-gray-200 text-gray-800 text-sm rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 placeholder:text-gray-400 shadow-sm ${error ? 'border-red-500 focus:ring-red-50' : 'border-gray-200'} ${className}`}
          {...props}
        />
      </div>
      {(error || helperText) && (
        <p className={`text-xs ${error ? 'text-red-500 font-medium' : 'text-gray-500 font-normal mt-0.5 tracking-tight'}`}>
          {error || helperText}
        </p>
      )}
    </div>
  );
};

export default Input;
