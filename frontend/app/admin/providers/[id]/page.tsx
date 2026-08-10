"use client";

import React from 'react';
import { useParams } from 'next/navigation';
import Provider360Profile from '@/components/admin/providers/Provider360Profile';

export default function Provider360Page() {
  const params = useParams();
  const providerId = (params?.id as string) || 'p12345';

  return <Provider360Profile providerId={providerId} />;
}

