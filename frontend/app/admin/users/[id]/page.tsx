"use client";

import React from 'react';
import { useParams } from 'next/navigation';
import Customer360Profile from '@/components/admin/users/Customer360Profile';

export default function Customer360Page() {
  const params = useParams();
  const userId = (params?.id as string) || 'u12345';

  return <Customer360Profile userId={userId} />;
}

