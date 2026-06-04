"use client";

import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  size?: 'sm' | 'md';
  rounded?: boolean;
}

const Badge: React.FC<BadgeProps> = ({ 
  children, 
  variant = 'neutral', 
  size = 'sm',
  rounded = true 
}) => {
  const baseStyles = "inline-flex items-center font-semibold tracking-wide";
  
  const variants = {
    success: "bg-green-100 text-green-700",
    warning: "bg-yellow-100 text-yellow-700",
    danger: "bg-red-100 text-red-700",
    info: "bg-blue-100 text-blue-700",
    neutral: "bg-gray-100 text-gray-700",
  };

  const sizes = {
    sm: "px-2.5 py-0.5 text-xs",
    md: "px-3 py-1 text-sm",
  };

  const borderRadius = rounded ? "rounded-full" : "rounded";

  return (
    <span className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${borderRadius}`}>
      {variant === 'success' && <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5"></span>}
      {variant === 'danger' && <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5"></span>}
      {children}
    </span>
  );
};

export default Badge;
