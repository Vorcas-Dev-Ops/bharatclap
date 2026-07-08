import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, Briefcase, Tag, Layers, ChevronRight } from 'lucide-react';
import { Provider } from '../../types';

interface ProviderServicesModalProps {
  isOpen: boolean;
  onClose: () => void;
  provider: Provider | null;
  locations: any[];
  categories: any[];
  services: any[];
  subservices: any[];
}

const ProviderServicesModal: React.FC<ProviderServicesModalProps> = ({
  isOpen, onClose, provider, locations, categories, services, subservices
}) => {
  if (!isOpen || !provider) return null;

  const providerServices = provider.services || [];

  interface GroupItem {
    categoryId: string;
    categoryName: string;
    serviceId: string;
    serviceName: string;
    subserviceName: string;
    locationIds: string[];
  }

  const rows: GroupItem[] = [];

  for (const ps of providerServices) {
    const subIds: string[] = ps.subservice_ids || [];
    const locIds: string[] = ps.location_ids || [];

    for (const subId of subIds) {
      const sub = subservices.find((s: any) => s._id === subId);
      if (!sub) continue;

      // service_id is populated: { _id, service_name, category_id: { _id, category_name } }
      const svcObj   = typeof sub.service_id === 'object' ? sub.service_id : null;
      const catObj   = svcObj ? (typeof svcObj.category_id === 'object' ? svcObj.category_id : null) : null;

      const catId    = catObj?._id || (typeof svcObj?.category_id === 'string' ? svcObj.category_id : null) || 'unknown';
      const catName  = catObj?.category_name || catObj?.name || categories.find((c: any) => c._id === catId)?.category_name || 'Uncategorized';
      const serviceId   = svcObj?._id || (typeof sub.service_id === 'string' ? sub.service_id : null) || 'unknown';
      const serviceName = svcObj?.service_name || svcObj?.name || services.find((s: any) => s._id === serviceId)?.service_name || 'Unknown Service';

      rows.push({
        categoryId:   String(catId),
        categoryName: catName,
        serviceId:    String(serviceId),
        serviceName:  serviceName,
        subserviceName: sub.subservice_name || sub.name || 'Unknown',
        locationIds:  locIds,
      });
    }
  }

  // Group: categoryId → serviceId → { serviceName, subservices[], locationIds[] }
  type ServiceGroup = { serviceName: string; subservices: string[]; locationIds: string[] };
  type CatGroup = { categoryName: string; services: Map<string, ServiceGroup> };
  const grouped = new Map<string, CatGroup>();

  for (const row of rows) {
    if (!grouped.has(row.categoryId)) {
      grouped.set(row.categoryId, { categoryName: row.categoryName, services: new Map() });
    }
    const catGroup = grouped.get(row.categoryId)!;
    if (!catGroup.services.has(row.serviceId)) {
      catGroup.services.set(row.serviceId, { serviceName: row.serviceName, subservices: [], locationIds: [] });
    }
    const svcGroup = catGroup.services.get(row.serviceId)!;
    svcGroup.subservices.push(row.subserviceName);
    for (const lid of row.locationIds) {
      if (!svcGroup.locationIds.includes(lid)) svcGroup.locationIds.push(lid);
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
              {groupedEntries.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-50 text-gray-300 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Briefcase size={26} />
                  </div>
                  <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">No Services Assigned</h3>
                  <p className="text-xs text-gray-500 mt-2 font-medium">This provider hasn't been assigned any services yet.</p>
                </div>
              ) : (
                groupedEntries.map(([catId, catGroup]) => (
                  <div key={catId} className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm">

                    {/* ── Category ── */}
                    <div className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white">
                      <Tag size={13} />
                      <span className="text-[11px] font-black uppercase tracking-widest">
                        {catGroup.categoryName}
                      </span>
                    </div>

                    <div className="divide-y divide-gray-50">
                      {Array.from(catGroup.services.entries()).map(([svcId, svcGroup]) => {
                        const areaNames = [...new Set(svcGroup.locationIds)]
                          .map(lid => locations.find((l: any) => l._id === lid)?.name)
                          .filter(Boolean) as string[];

                        return (
                          <div key={svcId} className="p-5 bg-white space-y-4">

                            {/* ── Service ── */}
                            <div className="flex items-center gap-2">
                              <Layers size={14} className="text-indigo-500 shrink-0" />
                              <span className="text-sm font-black text-gray-900">{svcGroup.serviceName}</span>
                            </div>

                            {/* ── Subservices ── */}
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

                            {/* ── Locations ── */}
                            <div className="ml-5">
                              <div className="flex items-center gap-1.5 mb-2">
                                <MapPin size={12} className="text-blue-500" />
                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                                  Service Areas
                                </span>
                              </div>
                              {areaNames.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {areaNames.map((name, i) => (
                                    <span
                                      key={i}
                                      className="px-2.5 py-1 bg-gray-50 border border-gray-200 text-gray-700 rounded-lg text-[10px] font-bold"
                                    >
                                      {name}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400 italic">No areas assigned</span>
                              )}
                            </div>

                          </div>
                        );
                      })}
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
