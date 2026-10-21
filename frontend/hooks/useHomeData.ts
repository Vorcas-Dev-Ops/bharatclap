"use client";

import { useState, useEffect } from 'react';
import { API_URL } from '@/config/api';

export interface HomeData {
  categories: any[];
  banners: any[];
  offers: any[];
}

const EMPTY_DATA: HomeData = { categories: [], banners: [], offers: [] };

let cachedData: HomeData | null = null;
let fetchPromise: Promise<HomeData> | null = null;
let isHydrated = false;

const fetchHomeData = async (): Promise<HomeData> => {
  if (fetchPromise) return fetchPromise;

  fetchPromise = fetch(`${API_URL}/customer/home`)
    .then(res => res.ok ? res.json() : (cachedData || EMPTY_DATA))
    .then(data => {
      if (Array.isArray(data?.categories) && data.categories.length > 0) {
        cachedData = data;
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.setItem('bc_home_data', JSON.stringify(data));
          } catch {}
        }
      }
      fetchPromise = null;
      return cachedData || data;
    })
    .catch(() => {
      fetchPromise = null;
      return cachedData || EMPTY_DATA;
    });

  return fetchPromise;
};

export function useHomeData() {
  // ponytail: ensure initial SSR and client hydration match before using client-only cache
  const [data, setData] = useState<HomeData>(isHydrated && cachedData ? cachedData : EMPTY_DATA);
  const [loading, setLoading] = useState(!(isHydrated && cachedData?.categories?.length));

  useEffect(() => {
    let mounted = true;
    isHydrated = true;

    // Restore cached session data immediately on mount if not already loaded
    if (!cachedData) {
      try {
        const raw = sessionStorage.getItem('bc_home_data');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed?.categories) && parsed.categories.length > 0) {
            cachedData = parsed;
            if (mounted) {
              setData(parsed);
              setLoading(false);
            }
          }
        }
      } catch {}
    } else if (mounted) {
      setData(cachedData);
      setLoading(false);
    }

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
