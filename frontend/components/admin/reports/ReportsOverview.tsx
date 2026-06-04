"use client";

import React from 'react';
import BIHeader from './BIHeader';
import BIKPICards from './BIKPICards';
import BIChartsGrid from './BIChartsGrid';
import BIDetailedInsights from './BIDetailedInsights';
import { motion } from 'framer-motion';

interface ReportsOverviewProps {
  stats: any;
  revenueChartData: any;
  userChartData: any;
}

export default function ReportsOverview({ stats, revenueChartData, userChartData }: ReportsOverviewProps) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 animate-in fade-in duration-700 pb-16"
    >
       {/* 1. Elite Filter Bureau & Heading */}
       <BIHeader />

       {/* 2. Rapid KPI Summary Rail */}
       <BIKPICards />

       {/* 3. Recharts Visualization Engine (Main Grid) */}
       <BIChartsGrid />

       {/* 4. Deep Audit Tables & Specialized Insights */}
       <BIDetailedInsights />
    </motion.div>
  );
}
