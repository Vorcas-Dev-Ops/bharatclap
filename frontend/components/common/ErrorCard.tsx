"use client";

import React from 'react';

interface ErrorCardProps {
  title?: string;
  message: string;
  onDismiss?: () => void;
}

export const ErrorCard: React.FC<ErrorCardProps> = ({
  title = 'Error',
  message,
  onDismiss,
}) => {
  return (
    <div className="p-4 bg-rose-50 border border-rose-200/80 rounded-xl flex items-start gap-3 my-3 text-rose-900">
      <span className="text-xl leading-none select-none">❌</span>
      <div className="flex-1 text-sm">
        {title && <p className="font-semibold mb-0.5">{title}</p>}
        <p className="text-rose-700 leading-snug">{message}</p>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-rose-400 hover:text-rose-600 transition text-lg leading-none p-1"
          aria-label="Dismiss error"
        >
          ×
        </button>
      )}
    </div>
  );
};

export default ErrorCard;
