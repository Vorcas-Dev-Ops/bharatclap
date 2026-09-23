import { Request, Response } from 'express';
import { getDb } from '../config/db';
import { getProvidersBatch, getCatalogBatch, getUsersBatch } from '../utils/internalApi';
import { getCache, setCache } from '../config/redis';

/* ─────────────────────────────────────────────────────────────────────────────
   1. REVENUE CHART  – monthly revenue for last 12 months (current vs previous year)
──────────────────────────────────────────────────────────────────────────── */
export const getRevenueChart = async (req: Request, res: Response): Promise<void> => {
  try {
    const { grouping = 'monthly' } = req.query;
    const cacheKey = `charts:revenue:${grouping}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      res.json(JSON.parse(cached));
      return;
    }

    const db = getDb();
    const now = new Date();
    const currentYear = now.getFullYear();
    const previousYear = currentYear - 1;

    let labels: string[] = [];
    let currentData: number[] = [];
    let previousData: number[] = [];

    if (grouping === 'daily') {
      const currentStart = new Date(now);
      currentStart.setDate(now.getDate() - 13);
      currentStart.setHours(0, 0, 0, 0);

      const previousStart = new Date(currentStart);
      previousStart.setDate(currentStart.getDate() - 14);

      const result = await db.query(`
        SELECT 
          CASE WHEN COALESCE(completed_at, created_at) >= $3 THEN 'current' ELSE 'previous' END AS period,
          EXTRACT(YEAR FROM COALESCE(completed_at, created_at))::int AS year,
          EXTRACT(MONTH FROM COALESCE(completed_at, created_at))::int AS month,
          EXTRACT(DAY FROM COALESCE(completed_at, created_at))::int AS day,
          COALESCE(SUM(COALESCE(payable_amount, service_price, 0)), 0)::float AS revenue
        FROM booking.bookings
        WHERE deleted_at IS NULL AND status IN ('completed', 'service_completed')
          AND ((completed_at >= $1 AND completed_at <= $2) OR (created_at >= $1 AND created_at <= $2))
        GROUP BY 1, 2, 3, 4
      `, [previousStart, now, currentStart]);

      for (let i = 0; i < 14; i++) {
        const d = new Date(currentStart);
        d.setDate(d.getDate() + i);
        labels.push(`${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' })}`);
        currentData.push(0);
        previousData.push(0);
      }

      result.rows.forEach((d: any) => {
        const dateStr = `${d.year}-${d.month}-${d.day}`;
        const rev = Math.round(d.revenue);

        for (let i = 0; i < 14; i++) {
          const cd = new Date(currentStart);
          cd.setDate(cd.getDate() + i);
          if (`${cd.getFullYear()}-${cd.getMonth() + 1}-${cd.getDate()}` === dateStr) {
            if (d.period === 'current') currentData[i] = rev;
          }
          const pd = new Date(previousStart);
          pd.setDate(pd.getDate() + i);
          if (`${pd.getFullYear()}-${pd.getMonth() + 1}-${pd.getDate()}` === dateStr) {
            if (d.period === 'previous') previousData[i] = rev;
          }
        }
      });
    } else if (grouping === 'quarterly') {
      const startDate = new Date(`${previousYear}-01-01`);
      const endDate = new Date(`${currentYear}-12-31T23:59:59.999Z`);

      const result = await db.query(`
        SELECT 
          EXTRACT(YEAR FROM created_at)::int AS year,
          EXTRACT(QUARTER FROM created_at)::int AS quarter,
          COALESCE(SUM(COALESCE(payable_amount, service_price, 0)), 0)::float AS revenue
        FROM booking.bookings
        WHERE deleted_at IS NULL AND status IN ('completed', 'service_completed')
          AND created_at >= $1 AND created_at <= $2
        GROUP BY 1, 2
      `, [startDate, endDate]);

      labels = ['Q1', 'Q2', 'Q3', 'Q4'];
      currentData = [0, 0, 0, 0];
      previousData = [0, 0, 0, 0];

      result.rows.forEach((d: any) => {
        const rev = Math.round(d.revenue);
        const idx = d.quarter - 1;
        if (d.year === currentYear) currentData[idx] = rev;
        else if (d.year === previousYear) previousData[idx] = rev;
      });
    } else if (grouping === 'yearly') {
      const startYear = currentYear - 4;
      const startDate = new Date(`${startYear}-01-01`);
      const endDate = new Date(`${currentYear}-12-31T23:59:59.999Z`);

      const result = await db.query(`
        SELECT 
          EXTRACT(YEAR FROM created_at)::int AS year,
          COALESCE(SUM(COALESCE(payable_amount, service_price, 0)), 0)::float AS revenue
        FROM booking.bookings
        WHERE deleted_at IS NULL AND status IN ('completed', 'service_completed')
          AND created_at >= $1 AND created_at <= $2
        GROUP BY 1
      `, [startDate, endDate]);

      for (let i = 0; i < 5; i++) {
        labels.push(String(startYear + i));
        currentData.push(0);
        previousData.push(0);
      }

      result.rows.forEach((d: any) => {
        const rev = Math.round(d.revenue);
        const idx = d.year - startYear;
        if (idx >= 0 && idx < 5) currentData[idx] = rev;
      });
    } else {
      // Monthly (default)
      const startDate = new Date(`${previousYear}-01-01`);
      const endDate = new Date(`${currentYear}-12-31T23:59:59.999Z`);

      const result = await db.query(`
        SELECT 
          EXTRACT(YEAR FROM created_at)::int AS year,
          EXTRACT(MONTH FROM created_at)::int AS month,
          COALESCE(SUM(COALESCE(payable_amount, service_price, 0)), 0)::float AS revenue
        FROM booking.bookings
        WHERE deleted_at IS NULL AND status IN ('completed', 'service_completed')
          AND created_at >= $1 AND created_at <= $2
        GROUP BY 1, 2
      `, [startDate, endDate]);

      labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      currentData = Array(12).fill(0);
      previousData = Array(12).fill(0);

      result.rows.forEach((d: any) => {
        const rev = Math.round(d.revenue);
        const idx = d.month - 1;
        if (d.year === currentYear) currentData[idx] = rev;
        else if (d.year === previousYear) previousData[idx] = rev;
      });
    }

    const totalRevenue = currentData.reduce((a, b) => a + b, 0);
    const totalPrev = previousData.reduce((a, b) => a + b, 0);
    const growthPct = totalPrev > 0 ? (((totalRevenue - totalPrev) / totalPrev) * 100).toFixed(1) : '0.0';

    const chartResult = { months: labels, currentData, previousData, totalRevenue, growthPct };
    await setCache(cacheKey, chartResult, 60);
    res.json(chartResult);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   2. BOOKING CHART  – daily bookings for current week vs previous week
──────────────────────────────────────────────────────────────────────────── */
export const getBookingChart = async (req: Request, res: Response): Promise<void> => {
  try {
    const cacheKey = `charts:bookings`;
    const cached = await getCache(cacheKey);
    if (cached) {
      res.json(JSON.parse(cached));
      return;
    }

    const db = getDb();
    const now = new Date();
    const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const currentWeekStart = new Date(now);
    currentWeekStart.setDate(now.getDate() - dayOfWeek);
    currentWeekStart.setHours(0, 0, 0, 0);

    const previousWeekStart = new Date(currentWeekStart);
    previousWeekStart.setDate(currentWeekStart.getDate() - 7);

    const result = await db.query(`
      SELECT 
        CASE WHEN created_at >= $1 THEN 'current' ELSE 'previous' END AS week,
        EXTRACT(ISODOW FROM created_at)::int AS day_of_week,
        COUNT(*)::int AS count
      FROM booking.bookings
      WHERE deleted_at IS NULL
        AND created_at >= $2 AND created_at <= $3
      GROUP BY 1, 2
    `, [currentWeekStart, previousWeekStart, now]);

    const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const currentWeek = Array(7).fill(0);
    const previousWeek = Array(7).fill(0);

    result.rows.forEach((d: any) => {
      // ISODOW: 1=Mon .. 7=Sun -> index 0..6
      const idx = d.day_of_week - 1;
      if (idx < 0 || idx > 6) return;
      if (d.week === 'current') currentWeek[idx] = d.count;
      else previousWeek[idx] = d.count;
    });

    const chartResult = { days: DAYS, currentWeek, previousWeek };
    await setCache(cacheKey, chartResult, 300);
    res.json(chartResult);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   3. ORDER STATUS (Donut)  – completed / pending / cancelled percentages
──────────────────────────────────────────────────────────────────────────── */
export const getOrderStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const cacheKey = `charts:orderStatus`;
    const cached = await getCache(cacheKey);
    if (cached) {
      res.json(JSON.parse(cached));
      return;
    }

    const db = getDb();
    const result = await db.query(`
      SELECT status, COUNT(*)::int AS count
      FROM booking.bookings
      WHERE deleted_at IS NULL
      GROUP BY status
    `);

    let completed = 0, pending = 0, cancelled = 0, total = 0;
    result.rows.forEach((d: any) => {
      total += d.count;
      if (d.status === 'completed' || d.status === 'service_completed') completed += d.count;
      else if (['cancelled', 'rejected', 'refund_processing', 'unassigned_timeout', 'HIGH_DEMAND_TIMEOUT'].includes(d.status)) cancelled += d.count;
      else pending += d.count;
    });

    const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;

    const chartResult = {
      total,
      data: [
        { name: 'Completed', value: pct(completed), color: '#2563EB' },
        { name: 'Pending', value: pct(pending), color: '#60A5FA' },
        { name: 'Cancelled', value: pct(cancelled), color: '#F87171' }
      ]
    };
    await setCache(cacheKey, chartResult, 300);
    res.json(chartResult);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   4. SERVICE DISTRIBUTION (Pie)  – top 5 services by booking count
──────────────────────────────────────────────────────────────────────────── */
export const getServiceDistribution = async (req: Request, res: Response): Promise<void> => {
  try {
    const cacheKey = `charts:serviceDistribution`;
    const cached = await getCache(cacheKey);
    if (cached) {
      res.json(JSON.parse(cached));
      return;
    }

    const db = getDb();
    const result = await db.query(`
      SELECT subservice_id, COUNT(*)::int AS count
      FROM booking.bookings
      WHERE deleted_at IS NULL AND subservice_id IS NOT NULL
      GROUP BY subservice_id
      ORDER BY count DESC
      LIMIT 10
    `);

    const subserviceIds = result.rows.map((d: any) => d.subservice_id?.toString()).filter(Boolean);

    if (subserviceIds.length === 0) {
      res.json({ services: [] });
      return;
    }

    const catalogData = await getCatalogBatch(subserviceIds, [], [], []);
    const serviceIds = [...new Set(catalogData.subservices.map((s: any) => (s.service_id || s._id)?.toString()).filter(Boolean))];
    const catalogData2 = serviceIds.length > 0 ? await getCatalogBatch([], serviceIds, [], []) : { subservices: [], services: [], categories: [], coupons: [] };

    const serviceMap = new Map(catalogData2.services.map((s: any) => [String(s._id || s.id), s.service_name || s.name || 'Unknown']));
    const subserviceMap = new Map(catalogData.subservices.map((s: any) => [
      String(s._id || s.id),
      String(serviceMap.get(String(s.service_id)) || s.subservice_name || s.name || 'Unknown')
    ]));

    const COLORS = ['#2563EB', '#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE', '#DBEAFE'];
    const serviceCountMap = new Map<string, number>();
    let grandTotal = 0;

    result.rows.forEach((d: any) => {
      const name = subserviceMap.get(String(d.subservice_id)) || 'Others';
      serviceCountMap.set(name, (serviceCountMap.get(name) || 0) + d.count);
      grandTotal += d.count;
    });

    const sorted = [...serviceCountMap.entries()].sort((a, b) => b[1] - a[1]);
    const top4 = sorted.slice(0, 4);
    const othersCount = sorted.slice(4).reduce((acc, [, c]) => acc + c, 0);
    if (othersCount > 0) top4.push(['Others', othersCount]);

    const resServices = top4.map(([name, count], i) => ({
      name,
      value: grandTotal > 0 ? Math.round((count / grandTotal) * 100) : 0,
      color: COLORS[i] || COLORS[COLORS.length - 1]
    }));

    const sum = resServices.reduce((a, b) => a + b.value, 0);
    if (resServices.length > 0 && sum !== 100) resServices[0].value += (100 - sum);

    const finalResult = { services: resServices };
    await setCache(cacheKey, finalResult, 300);
    res.json(finalResult);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   5. PROVIDER PERFORMANCE  – top 5 providers by completed jobs + avg rating
──────────────────────────────────────────────────────────────────────────── */
export const getProviderPerformance = async (req: Request, res: Response): Promise<void> => {
  try {
    const cacheKey = `charts:providerPerformance`;
    const cached = await getCache(cacheKey);
    if (cached) {
      res.json(JSON.parse(cached));
      return;
    }

    const db = getDb();
    const result = await db.query(`
      SELECT provider_id, COUNT(*)::int AS jobs
      FROM booking.bookings
      WHERE deleted_at IS NULL AND status IN ('completed', 'service_completed') AND provider_id IS NOT NULL
      GROUP BY provider_id
      ORDER BY jobs DESC
      LIMIT 5
    `);

    const providerIds = result.rows.map((d: any) => d.provider_id?.toString()).filter(Boolean);

    const providers = providerIds.length > 0 ? await getProvidersBatch(providerIds) : [];
    const provMap = new Map(providers.map((p: any) => [String(p._id || p.id), p]));

    const chartProviders = result.rows.map((d: any) => {
      const p: any = provMap.get(String(d.provider_id)) || {};
      return {
        name: p.name || p.full_name || 'Unknown Provider',
        jobs: d.jobs,
        rating: parseFloat((p.average_rating || p.rating || 4.5).toFixed(1))
      };
    });

    const finalResult = { providers: chartProviders };
    await setCache(cacheKey, finalResult, 300);
    res.json(finalResult);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   6. PEAK TIME HEATMAP  – booking density by day-of-week × hour slot
──────────────────────────────────────────────────────────────────────────── */
export const getPeakTimeHeatmap = async (req: Request, res: Response): Promise<void> => {
  try {
    const cacheKey = `charts:peakTime`;
    const cached = await getCache(cacheKey);
    if (cached) {
      res.json(JSON.parse(cached));
      return;
    }

    const db = getDb();
    const HOURS = ['9am', '11am', '1pm', '3pm', '5pm', '7pm', '9pm'];
    const HOUR_RANGES = [9, 11, 13, 15, 17, 19, 21];
    const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    const result = await db.query(`
      SELECT 
        EXTRACT(ISODOW FROM created_at)::int AS day_of_week,
        EXTRACT(HOUR FROM (created_at AT TIME ZONE 'Asia/Kolkata'))::int AS hour,
        COUNT(*)::int AS count
      FROM booking.bookings
      WHERE deleted_at IS NULL
      GROUP BY 1, 2
    `);

    // counts[day 0-6 Mon-Sun][hourSlot 0-6]
    const counts: number[][] = Array.from({ length: 7 }, () => Array(7).fill(0));

    result.rows.forEach((d: any) => {
      // ISODOW: 1=Mon .. 7=Sun -> index 0..6
      const dayIdx = d.day_of_week - 1;
      if (dayIdx < 0 || dayIdx > 6) return;
      const h = d.hour;
      const slotIdx = HOUR_RANGES.findIndex((hr, i) =>
        h >= hr && (i === HOUR_RANGES.length - 1 || h < HOUR_RANGES[i + 1])
      );
      if (slotIdx < 0) return;
      counts[dayIdx][slotIdx] += d.count;
    });

    const maxCount = Math.max(...counts.flat(), 1);
    const data = counts.map(row => row.map(c => Math.round((c / maxCount) * 100) / 100));

    const finalResult = { hours: HOURS, days: DAYS, data };
    await setCache(cacheKey, finalResult, 600);
    res.json(finalResult);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   7. RECENT REVIEWS  – latest 5 reviews with user + provider names
──────────────────────────────────────────────────────────────────────────── */
export const getRecentReviews = async (req: Request, res: Response): Promise<void> => {
  try {
    const cacheKey = `charts:recentReviews`;
    const cached = await getCache(cacheKey);
    if (cached) {
      res.json(JSON.parse(cached));
      return;
    }

    const db = getDb();
    const reviewsResult = await db.query(`
      SELECT id, booking_id, user_id, provider_id, rating, comment, created_at
      FROM booking.reviews
      ORDER BY created_at DESC
      LIMIT 5
    `);

    const reviews = reviewsResult.rows;
    if (reviews.length === 0) {
      res.json({ reviews: [] });
      return;
    }

    const userIds = [...new Set(reviews.map((r: any) => r.user_id?.toString()).filter(Boolean))];
    const providerIds = [...new Set(reviews.map((r: any) => r.provider_id?.toString()).filter(Boolean))];

    const [users, providers] = await Promise.all([
      getUsersBatch(userIds).catch(() => []),
      getProvidersBatch(providerIds).catch(() => []),
    ]);

    const userMap = new Map((users as any[]).map(u => [String(u._id || u.id), u]));
    const provMap = new Map((providers as any[]).map(p => [String(p._id || p.id), p]));

    const result = reviews.map((r: any) => {
      const u: any = userMap.get(String(r.user_id)) || {};
      const p: any = provMap.get(String(r.provider_id)) || {};
      return {
        user: u.name || u.full_name || u.phone || 'Customer',
        rating: r.rating,
        comment: r.comment || '',
        provider: p.name || p.full_name || 'Provider',
      };
    });

    const finalResult = { reviews: result };
    await setCache(cacheKey, finalResult, 300);
    res.json(finalResult);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
