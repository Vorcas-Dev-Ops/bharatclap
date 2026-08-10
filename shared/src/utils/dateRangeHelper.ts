export type DatePresetType =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_7_days'
  | 'last_15_days'
  | 'last_30_days'
  | 'this_month'
  | 'last_month'
  | 'this_fy'
  | 'last_fy'
  | 'custom';

export interface DateRangeResult {
  startDate: Date;
  endDate: Date;
  preset: DatePresetType;
}

export const getDateRange = (
  preset: DatePresetType = 'today',
  customStart?: string | Date,
  customEnd?: string | Date
): DateRangeResult => {
  const now = new Date();
  let startDate = new Date();
  let endDate = new Date();

  // Helper to set start of day
  const startOfDay = (d: Date): Date => {
    const res = new Date(d);
    res.setHours(0, 0, 0, 0);
    return res;
  };

  // Helper to set end of day
  const endOfDay = (d: Date): Date => {
    const res = new Date(d);
    res.setHours(23, 59, 59, 999);
    return res;
  };

  switch (preset) {
    case 'today':
      startDate = startOfDay(now);
      endDate = endOfDay(now);
      break;

    case 'yesterday':
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      startDate = startOfDay(y);
      endDate = endOfDay(y);
      break;

    case 'this_week':
      const firstDayOfWeek = new Date(now);
      const day = firstDayOfWeek.getDay();
      const diffToMonday = firstDayOfWeek.getDate() - day + (day === 0 ? -6 : 1);
      firstDayOfWeek.setDate(diffToMonday);
      startDate = startOfDay(firstDayOfWeek);
      endDate = endOfDay(now);
      break;

    case 'last_7_days':
      startDate = startOfDay(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000));
      endDate = endOfDay(now);
      break;

    case 'last_15_days':
      startDate = startOfDay(new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000));
      endDate = endOfDay(now);
      break;

    case 'last_30_days':
      startDate = startOfDay(new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000));
      endDate = endOfDay(now);
      break;

    case 'this_month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      endDate = endOfDay(now);
      break;

    case 'last_month':
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      break;

    case 'this_fy': {
      // Indian Financial Year: April 1 to March 31
      const currentYear = now.getFullYear();
      const fyStartYear = now.getMonth() >= 3 ? currentYear : currentYear - 1;
      startDate = new Date(fyStartYear, 3, 1, 0, 0, 0, 0); // April 1
      endDate = endOfDay(now);
      break;
    }

    case 'last_fy': {
      const currentYear = now.getFullYear();
      const fyStartYear = (now.getMonth() >= 3 ? currentYear : currentYear - 1) - 1;
      startDate = new Date(fyStartYear, 3, 1, 0, 0, 0, 0); // April 1 previous year
      endDate = new Date(fyStartYear + 1, 2, 31, 23, 59, 59, 999); // March 31
      break;
    }

    case 'custom':
      startDate = customStart ? startOfDay(new Date(customStart)) : startOfDay(now);
      endDate = customEnd ? endOfDay(new Date(customEnd)) : endOfDay(now);
      break;

    default:
      startDate = startOfDay(now);
      endDate = endOfDay(now);
      break;
  }

  return { startDate, endDate, preset };
};
