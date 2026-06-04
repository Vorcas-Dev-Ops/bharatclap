"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";

interface SubService {
  name: string;
  image?: string;
  attributionLink?: string;
  id: string;
  badge?: string;
  duration?: string;
  icon?: LucideIcon;
}

interface ServiceGroup {
  title: string;
  services: SubService[];
}

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  categoryName: string;
  serviceGroups: ServiceGroup[];
}

const CategoryModal: React.FC<CategoryModalProps> = ({
  isOpen,
  onClose,
  categoryName,
  serviceGroups,
}) => {
  const router = useRouter();

  const handleServiceClick = (serviceId: string) => {
    onClose();
    // Navigate to the dynamic booking page for this specific sub-category
    router.push(`/service/${serviceId}`);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-[4px] z-[200]"
          />

          {/* Modal Content */}
          <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-[201] p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 30, stiffness: 400 }}
              className="bg-white pointer-events-auto w-full max-w-lg rounded-[32px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] overflow-hidden relative flex flex-col"
            >
              <button
                onClick={onClose}
                className="absolute top-6 right-6 p-2.5 hover:bg-slate-50 transition-all rounded-full z-10 bg-white/80 backdrop-blur-sm shadow-sm"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>

              {/* Header and Content Wrapper */}
              <div className="flex-1 p-8 sm:p-10">
                <div className="space-y-10">
                  <h2 className="text-2xl font-black text-slate-800 tracking-tight text-center sm:text-left">
                    {categoryName}
                  </h2>

                  {serviceGroups.map((group, groupIdx) => (
                    <div key={groupIdx} className="space-y-6">
                      {group.title && (
                        <div className="flex items-center gap-4">
                          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap">
                            {group.title}
                          </h3>
                          <div className="h-px w-full bg-slate-100" />
                        </div>
                      )}
                      
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-8 max-w-lg mx-auto sm:mx-0">
                        {group.services.map((service, serviceIdx) => {
                          const Icon = service.icon;
                          return (
                            <motion.button
                              key={serviceIdx}
                              whileHover={{ y: -4 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleServiceClick(service.id)}
                              className="group flex flex-col items-center gap-3"
                            >
                              <div className="relative w-full aspect-square bg-slate-50 rounded-[24px] flex items-center justify-center transition-all group-hover:bg-white group-hover:shadow-[0_12px_24px_-8px_rgba(0,0,0,0.1)] overflow-hidden border border-transparent group-hover:border-slate-100/50">
                                {service.image ? (
                                  <img 
                                    src={service.image} 
                                    alt={service.name} 
                                    className="w-[50%] h-[50%] object-contain"
                                  />
                                ) : Icon ? (
                                  <Icon className="w-7 h-7 text-slate-400 group-hover:text-[#1D2B83] transition-colors" />
                                ) : (
                                  <div className="w-2.5 h-2.5 rounded-full bg-[#1D2B83] opacity-20" />
                                )}

                                {/* Badge */}
                                {service.badge && (
                                  <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-[#E6F9F0] text-[#008A4E] text-[7px] font-bold rounded-full leading-none border border-[#BFF0D9]">
                                    {service.badge}
                                  </div>
                                )}

                                {/* Duration Label */}
                                {service.duration && (
                                  <div className="absolute bottom-2 inset-x-2 flex justify-center">
                                    <div className="px-1.5 py-0.5 bg-white/90 backdrop-blur-[2px] text-slate-500 text-[7px] font-black rounded-md shadow-sm border border-slate-50">
                                      {service.duration}
                                    </div>
                                  </div>
                                )}
                              </div>
                              
                              <span className="text-[10px] font-bold text-center leading-tight text-slate-600 group-hover:text-[#1D2B83] transition-colors line-clamp-2 px-1">
                                {service.name}
                              </span>
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CategoryModal;
