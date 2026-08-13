"use client";

import { useState, useEffect } from 'react';
import { API_URL } from '@/config/api';

export interface HomeData {
  categories: any[];
  banners: any[];
  offers: any[];
}

// ponytail: single BFF request for the entire home screen instead of 3 separate fetches
let cachedData: HomeData | null = null;
let fetchPromise: Promise<HomeData> | null = null;

const fetchHomeData = async (): Promise<HomeData> => {
  if (cachedData) return cachedData;
  if (fetchPromise) return fetchPromise;

  fetchPromise = fetch(`${API_URL}/customer/home`)
    .then(res => res.ok ? res.json() : { categories: [], banners: [], offers: [] })
    .then(data => {
      cachedData = data;
      fetchPromise = null;
      return data;
    })
    .catch(() => {
      fetchPromise = null;
      return { categories: [], banners: [], offers: [] };
    });

  return fetchPromise;
};

export function useHomeData() {
  const [data, setData] = useState<HomeData>(cachedData || { categories: [], banners: [], offers: [] });
  const [loading, setLoading] = useState(!cachedData);

  useEffect(() => {
    let mounted = true;
    fetchHomeData().then(d => {
      if (mounted) {
        setData(d);
        setLoading(false);
      }
    });
    return () => { mounted = false; };
  }, []);

  return { ...data, loading };
}
