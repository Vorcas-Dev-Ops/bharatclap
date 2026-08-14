"use client";

import React from 'react';
import { useParams } from 'next/navigation';
import BookingSingleView from '@/components/admin/bookings/BookingSingleView';

export default function BookingDetailPage() {
  const params = useParams();
  const bookingId = (params?.id as string) || '';

  return <BookingSingleView bookingId={bookingId} />;
}
