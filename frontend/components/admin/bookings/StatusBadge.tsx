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
    accepted: 'info',
    confirmed: 'info',
    in_progress: 'info',
    completed: 'success',
    cancelled: 'danger',
    rejected: 'danger',
  };

  const labels: Record<string, string> = {
    pending: 'Pending',
    accepted: 'Accepted',
    confirmed: 'Confirmed',
    in_progress: 'In Progress',
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
