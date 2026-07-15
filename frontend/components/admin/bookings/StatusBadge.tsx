"use client";

import React from 'react';
import Badge from '../common/Badge';

interface StatusBadgeProps {
  status: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status = '' }) => {
  const s = status.toLowerCase();
  
  const variants: Record<string, 'info' | 'warning' | 'success' | 'danger'> = {
    pending: 'warning',
    provider_searching: 'warning',
    accepted: 'info',
    confirmed: 'info',
    in_progress: 'info',
    waiting_start_otp: 'warning',
    waiting_end_otp: 'warning',
    completed: 'success',
    cancelled: 'danger',
    rejected: 'danger',
  };

  const labels: Record<string, string> = {
    pending: 'Pending',
    provider_searching: 'Searching Partner',
    accepted: 'Accepted',
    confirmed: 'Confirmed',
    in_progress: 'In Progress',
    waiting_start_otp: 'Waiting Start OTP',
    waiting_end_otp: 'Waiting End OTP',
    completed: 'Completed',
    cancelled: 'Cancelled',
    rejected: 'Rejected',
  };

  return (
    <Badge variant={variants[s] || 'info'} size="sm" rounded>
      {labels[s] || status}
    </Badge>
  );
};

export default StatusBadge;
