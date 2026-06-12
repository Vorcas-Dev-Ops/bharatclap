"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

interface ReportContextType {
  data: any;
  loading: boolean;
  filters: {
    dateRange: string;
    startDate: string;
    endDate: string;
  };
  setFilters: React.Dispatch<React.SetStateAction<{
    dateRange: string;
    startDate: string;
    endDate: string;
  }>>;
  exportReport: (format: 'pdf' | 'csv') => void;
}

const ReportContext = createContext<ReportContextType | undefined>(undefined);

export const ReportProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [filters, setFilters] = useState({
    dateRange: 'Last 30 Days',
    startDate: '',
    endDate: ''
  });
  
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReportData = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
        
        const params = new URLSearchParams({
          dateRange: filters.dateRange,
          startDate: filters.startDate,
          endDate: filters.endDate
        });

        const res = await fetch(`${API_BASE}/admin/reports?${params}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (!res.ok) throw new Error('Failed to fetch report data');
        
        const result = await res.json();
        setData(result);
      } catch (err) {
        console.error('Error fetching report data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchReportData();
  }, [filters]);

  const exportReport = (format: 'pdf' | 'csv') => {
    if (!data) return;

    if (format === 'pdf') {
      window.print();
      return;
    }

    if (format === 'csv') {
      let csvContent = "data:text/csv;charset=utf-8,";
      
      const addSection = (title: string, metrics: [string, any][]) => {
        csvContent += `${title}\nMetric,Value\n`;
        metrics.forEach(([key, value]) => {
          csvContent += `${key},${value}\n`;
        });
        csvContent += '\n';
      };

      addSection("REVENUE ANALYTICS", [
        ["Total Revenue", data.revenue.total],
        ["Commission Earned", data.revenue.commission],
        ["Provider Earnings", data.revenue.providerEarnings],
        ["Net Platform Profit", data.revenue.netProfit]
      ]);

      addSection("BOOKING ANALYTICS", [
        ["Total Bookings", data.booking.total],
        ["Completed %", data.booking.completedPct.toFixed(1)],
        ["Cancelled %", data.booking.cancelledPct.toFixed(1)],
        ["Pending %", data.booking.pendingPct.toFixed(1)]
      ]);

      addSection("PROVIDER ANALYTICS", [
        ["Top Earning Providers", data.provider.topEarning.amount],
        ["Most Booked Providers", data.provider.mostBooked.bookings],
        ["Highest Rated Providers", data.provider.highestRated.rating],
        ["Inactive Providers", data.provider.inactiveCount]
      ]);

      addSection("CUSTOMER ANALYTICS", [
        ["New Customers", data.customer.new],
        ["Repeat Customers", data.customer.repeat],
        ["Top Spending Customers", data.customer.topSpender.amount]
      ]);

      addSection("REFUND ANALYTICS", [
        ["Refund Rate", data.refund.rate],
        ["Refund Amount", data.refund.totalAmount]
      ]);

      addSection("COMMISSION ANALYTICS", [
        ["Total Commission Earned", data.commission.total]
      ]);

      // --- Chart Data Exports ---
      csvContent += `\n--- RAW CHART DATA FOR EXCEL ---\n\n`;
      
      csvContent += `REVENUE TREND\nDate,Revenue\n`;
      data.revenue.trend.forEach((t: any) => { csvContent += `${t.name},${t.revenue}\n`; });
      
      csvContent += `\nREVENUE BY CATEGORY\nCategory,Revenue\n`;
      data.revenue.byCategory.forEach((c: any) => { csvContent += `${c.name},${c.value}\n`; });
      
      csvContent += `\nBOOKINGS BY DAY\nDate,Bookings\n`;
      data.booking.trend.forEach((t: any) => { csvContent += `${t.name},${t.bookings}\n`; });
      
      csvContent += `\nPEAK BOOKING HOURS\nHour,Bookings\n`;
      data.booking.peakHours.forEach((h: any) => { csvContent += `${h.hour},${h.bookings}\n`; });
      
      csvContent += `\nREFUND AMOUNT TREND\nDate,Refund Amount\n`;
      data.refund.trend.forEach((t: any) => { csvContent += `${t.name},${t.amount}\n`; });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `bharatclap_report_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <ReportContext.Provider value={{ data, loading, filters, setFilters, exportReport }}>
      {children}
    </ReportContext.Provider>
  );
};

export const useReportContext = () => {
  const context = useContext(ReportContext);
  if (context === undefined) {
    throw new Error('useReportContext must be used within a ReportProvider');
  }
  return context;
};
