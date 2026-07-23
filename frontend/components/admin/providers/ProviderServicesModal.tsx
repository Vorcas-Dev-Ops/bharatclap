import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, Briefcase, Tag, Layers, ChevronRight, Loader2, AlertCircle, RefreshCcw } from 'lucide-react';
import { Provider } from '../types';
import axios from 'axios';
import { API_URL } from '@/config/api';

interface ProviderServicesModalProps {
  isOpen: boolean;
  onClose: () => void;
  provider: Provider | null;
  locations?: any[];
  categories?: any[];
  services?: any[];
  subservices?: any[];
}

const ProviderServicesModal: React.FC<ProviderServicesModalProps> = ({
  isOpen, onClose, provider, locations = [], categories = [], services = [], subservices = []
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydratedServices, setHydratedServices] = useState<any[]>([]);

  // In-memory cache with 5-minute TTL for instant modal reopenings & automatic freshness
  const portfolioCache = useRef<Map<string, { data: any[]; timestamp: number }>>(new Map());
  const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL

  useEffect(() => {
    if (!isOpen || !provider) return;

    const providerId = String(provider._id);

    // Check cache with TTL validation
    if (portfolioCache.current.has(providerId)) {
      const cached = portfolioCache.current.get(providerId)!;
      if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
        setHydratedServices(cached.data);
        setLoading(false);
        setError(null);
        return;
      }
    }

    fetchProviderServices(providerId);
  }, [isOpen, provider]);

  const fetchProviderServices = async (providerId: string) => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token') || localStorage.getItem('adminToken') || localStorage.getItem('jwt');
      const response = await axios.get(`${API_URL}/provider-services/${providerId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Consistent Response Normalization: Handle object wrapper or direct array
      const rawData = response.data;
      const items = Array.isArray(rawData) ? rawData : (rawData?.data || []);
      const serviceList = Array.isArray(items) ? items : [];

      portfolioCache.current.set(providerId, { data: serviceList, timestamp: Date.now() });
      setHydratedServices(serviceList);
    } catch (err: any) {
      console.warn('Error fetching provider services:', err?.message || err);
      setError(err?.response?.data?.message || 'Unable to load provider services. Please check your network connection.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !provider) return null;

  // Process hydrated data or fallback to props lookup
  interface GroupItem {
    categoryId: string;
    categoryName: string;
    serviceId: string;
    serviceName: string;
    subserviceName: string;
    locations: { id: string; name: string }[];
  }

  const rows: GroupItem[] = [];

  for (const ps of hydratedServices) {
    const rawSubs: any[] = ps.subservice_ids || [];
    const rawLocs: any[] = ps.location_ids || [];

    const parsedLocs = rawLocs.map((locItem: any) => {
      if (typeof locItem === 'object' && locItem !== null) {
        return { id: String(locItem._id || locItem.id), name: locItem.name || locItem.area_name || 'Area' };
      }
      const found = locations.find((l: any) => String(l._id) === String(locItem));
      return { id: String(locItem), name: found?.name || 'Area' };
    });

    for (const subItem of rawSubs) {
      let subObj: any = null;

      if (typeof subItem === 'object' && subItem !== null) {
        subObj = subItem;
      } else {
        subObj = subservices.find((s: any) => String(s._id) === String(subItem));
      }

      const subName = subObj?.subservice_name || subObj?.name || 'Assigned Subservice';
      const svcObj = typeof subObj?.service_id === 'object' ? subObj.service_id : null;
      const catObj = svcObj ? (typeof svcObj.category_id === 'object' ? svcObj.category_id : null) : null;

      const catId = catObj?._id || (typeof svcObj?.category_id === 'string' ? svcObj.category_id : 'uncat');
      const catName = catObj?.category_name || catObj?.name || categories.find((c: any) => String(c._id) === String(catId))?.category_name || 'Category';

      const serviceId = svcObj?._id || (typeof subObj?.service_id === 'string' ? subObj.service_id : 'uncat');
      const serviceName = svcObj?.service_name || svcObj?.name || services.find((s: any) => String(s._id) === String(serviceId))?.service_name || 'General Service';

      rows.push({
        categoryId: String(catId),
        categoryName: catName,
        serviceId: String(serviceId),
        serviceName,
        subserviceName: subName,
        locations: parsedLocs
      });
    }
  }

  // Group by categoryId -> serviceId
  type ServiceGroup = { serviceName: string; subservices: string[]; locations: { id: string; name: string }[] };
  type CatGroup = { categoryName: string; services: Map<string, ServiceGroup> };
  const grouped = new Map<string, CatGroup>();

  for (const row of rows) {
    if (!grouped.has(row.categoryId)) {
      grouped.set(row.categoryId, { categoryName: row.categoryName, services: new Map() });
    }
    const catGroup = grouped.get(row.categoryId)!;
    if (!catGroup.services.has(row.serviceId)) {
      catGroup.services.set(row.serviceId, { serviceName: row.serviceName, subservices: [], locations: [] });
    }
    const svcGroup = catGroup.services.get(row.serviceId)!;
    if (!svcGroup.subservices.includes(row.subserviceName)) {
      svcGroup.subservices.push(row.subserviceName);
    }
    for (const loc of row.locations) {
      if (!svcGroup.locations.some(l => l.id === loc.id)) {
        svcGroup.locations.push(loc);
      }
    }
  }

  const groupedEntries = Array.from(grouped.entries());

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-gray-900/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed z-[9999] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
                  <Briefcase size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-gray-900 uppercase tracking-[0.1em]">Service Portfolio</h2>
                  <p className="text-xs font-bold text-gray-500 mt-0.5">
                    {provider.user_id?.name || 'Expert'} — assigned capabilities
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              {loading ? (
                /* Skeleton Loader State */
                <div className="space-y-4 animate-pulse py-2">
                  {[1, 2].map((i) => (
                    <div key={i} className="border border-gray-100 rounded-2xl overflow-hidden shadow-xs bg-white">
                      <div className="h-9 bg-blue-100/60 flex items-center px-5 gap-2">
                        <div className="w-4 h-4 rounded-full bg-blue-200" />
                        <div className="h-3 bg-blue-200/80 rounded w-28" />
                      </div>
                      <div className="p-5 space-y-4">
                        <div className="h-4 bg-gray-200 rounded-md w-1/3" />
                        <div className="flex gap-2">
                          <div className="h-7 bg-indigo-50 border border-indigo-100/50 rounded-xl w-28" />
                          <div className="h-7 bg-indigo-50 border border-indigo-100/50 rounded-xl w-36" />
                        </div>
                        <div className="space-y-2 pt-2">
                          <div className="h-3 bg-gray-100 rounded w-20" />
                          <div className="flex gap-1.5">
                            <div className="h-6 bg-gray-100 rounded-lg w-20" />
                            <div className="h-6 bg-gray-100 rounded-lg w-24" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : error ? (
                /* Error State (SC-4) */
                <div className="text-center py-12 px-4 bg-red-50/50 rounded-2xl border border-red-100">
                  <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <AlertCircle size={22} />
                  </div>
                  <h3 className="text-sm font-black text-red-900 uppercase tracking-wider">
                    Unable to Load Portfolio
                  </h3>
                  <p className="text-xs text-red-600 mt-1 font-medium max-w-md mx-auto">{error}</p>
                  <button
                    onClick={() => fetchProviderServices(String(provider._id))}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm"
                  >
                    <RefreshCcw size={14} />
                    Retry
                  </button>
                </div>
              ) : groupedEntries.length === 0 ? (
                /* Empty State (SC-3) */
                <div className="text-center py-14">
                  <div className="w-16 h-16 bg-gray-50 text-gray-300 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Briefcase size={26} />
                  </div>
                  <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">No Services Assigned</h3>
                  <p className="text-xs text-gray-500 mt-2 font-medium">This provider hasn't been assigned any services yet.</p>
                </div>
              ) : (
                /* Hydrated Portfolio Content */
                groupedEntries.map(([catId, catGroup]) => (
                  <div key={catId} className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                    {/* Category Header */}
                    <div className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white">
                      <Tag size={13} />
                      <span className="text-[11px] font-black uppercase tracking-widest">
                        {catGroup.categoryName}
                      </span>
                    </div>

                    <div className="divide-y divide-gray-50">
                      {Array.from(catGroup.services.entries()).map(([svcId, svcGroup]) => (
                        <div key={svcId} className="p-5 bg-white space-y-4">
                          {/* Service Title */}
                          <div className="flex items-center gap-2">
                            <Layers size={14} className="text-indigo-500 shrink-0" />
                            <span className="text-sm font-black text-gray-900">{svcGroup.serviceName}</span>
                          </div>

                          {/* Subservices List */}
                          <div className="ml-5 flex flex-wrap gap-2">
                            {svcGroup.subservices.map((name, i) => (
                              <span
                                key={i}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-xl text-[11px] font-bold"
                              >
                                <ChevronRight size={10} />
                                {name}
                              </span>
                            ))}
                          </div>

                          {/* Service Areas */}
                          <div className="ml-5">
                            <div className="flex items-center gap-1.5 mb-2">
                              <MapPin size={12} className="text-blue-500" />
                              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                                Service Areas
                              </span>
                            </div>
                            {svcGroup.locations.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {svcGroup.locations.map((loc, i) => (
                                  <span
                                    key={i}
                                    className="px-2.5 py-1 bg-gray-50 border border-gray-200 text-gray-700 rounded-lg text-[10px] font-bold"
                                  >
                                    {loc.name}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400 italic">No areas assigned</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-gray-100 bg-gray-50/50 flex justify-end">
              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-gray-900 hover:bg-gray-700 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all"
              >
                Close
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ProviderServicesModal;
