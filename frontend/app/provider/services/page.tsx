"use client";

import React, { useState, useEffect } from "react";
import AddServiceModal from "@/components/provider/modals/AddServiceModal";
import EditServiceModal from "@/components/provider/modals/EditServiceModal";
import DeleteServiceModal from "@/components/provider/modals/DeleteServiceModal";
import ToggleServiceModal from "@/components/provider/modals/ToggleServiceModal";
import { API_URL, apiClient } from "@/config/api";
import {
  Plus,
  Search,
  Edit2,
  Star,
  Clock,
  Zap,
  ToggleLeft as Toggle,
  ToggleRight,
  Sparkles,
  Loader2,
  MapPin
} from "lucide-react";

export default function ServicesPage() {
  const [services, setServices] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [catalogServices, setCatalogServices] = useState<any[]>([]);
  const [locationMap, setLocationMap] = useState<Map<string, any>>(new Map());
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isToggleModalOpen, setIsToggleModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [providerId, setProviderId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("jwt");
      if (!token) return;

      // 1. Fetch Provider Profile
      const providerRes = await apiClient.get(`/providers/me`);
      const pId = providerRes.data._id;
      setProviderId(pId);

      // 2. Fetch Provider Services, Categories, Catalog Services, and Locations in parallel
      if (pId) {
        const [servicesRes, catRes, srvRes, locRes] = await Promise.all([
          apiClient.get(`/provider-services/${pId}`),
          apiClient.get(`/categories`),
          apiClient.get(`/services`),
          apiClient.get(`/locations`)
        ]);
        setServices(servicesRes.data.data || []);
        setCategories(catRes.data);
        setCatalogServices(srvRes.data);

        // Build a reliable ID → location object map on the frontend
        const map = new Map<string, any>();
        (locRes.data || []).forEach((loc: any) => {
          map.set(String(loc._id), loc);
        });
        setLocationMap(map);
      }
    } catch (error) {
      console.error("Error fetching services:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleClick = (service: any) => {
    setSelectedService(service);
    setIsToggleModalOpen(true);
  };

  const confirmToggleService = async () => {
    if (!selectedService) return;
    setIsToggling(true);
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("jwt");
      await apiClient.put(`/provider-services/${selectedService._id}`,
        { is_available: !selectedService.is_available }
      );
      setServices(services.map(s => s._id === selectedService._id ? { ...s, is_available: !selectedService.is_available } : s));
      setIsToggleModalOpen(false);
      setSelectedService(null);
    } catch (error) {
      console.error("Error toggling availability:", error);
    } finally {
      setIsToggling(false);
    }
  };

  const handleDeleteService = (service: any) => {
    setSelectedService(service);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteService = async () => {
    if (!selectedService) return;

    setIsDeleting(true);
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("jwt");
      await apiClient.delete(`/provider-services/${selectedService._id}`);
      setServices(services.filter(s => s._id !== selectedService._id));
      setIsDeleteModalOpen(false);
      setSelectedService(null);
    } catch (error) {
      console.error("Error deleting service:", error);
      alert("Failed to delete service. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditClick = (service: any) => {
    setSelectedService(service);
    setIsEditModalOpen(true);
  };

  return (
    <div className="space-y-8 w-full text-left">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Services Management</h1>
          <p className="text-slate-500 font-medium">Manage your service offerings, pricing, and availability.</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary-dark transition-all shadow-lg shadow-primary/20"
        >
          <Plus className="h-4 w-4" />
          Add New Service
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-2xl w-full">
        <div className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-xl border border-slate-100 w-full md:w-96">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by category, service, or subservice..."
            className="bg-transparent border-none outline-none text-sm text-slate-600 w-full font-medium"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <select 
            className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-primary w-full md:w-40"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All Status">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Services Grid */}
      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center gap-4 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-bold">Loading your services...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5 gap-8">
          {(() => {
            const filteredServices = services.filter(service => {
              // 1. Status Filter
              if (statusFilter === "Active" && !service.is_available) return false;
              if (statusFilter === "Inactive" && service.is_available) return false;

              // 2. Search Query Filter
              if (!searchQuery) return true;
              const query = searchQuery.toLowerCase();

              // Get subservice names
              const subserviceNames = (service.subservice_ids || []).map((sub: any) => sub.subservice_name?.toLowerCase() || "");

              // Get service and category names
              const firstSub = service.subservice_ids?.[0];
              let serviceName = "";
              let categoryName = "";
              if (firstSub?.service_id) {
                 const parentService = catalogServices.find(s => s._id === firstSub.service_id);
                 serviceName = parentService?.service_name?.toLowerCase() || "";
                 categoryName = parentService?.category_id?.category_name?.toLowerCase() || "";
              }

              // Check if query matches any
              return (
                categoryName.includes(query) ||
                serviceName.includes(query) ||
                subserviceNames.some((name: string) => name.includes(query))
              );
            });

            if (filteredServices.length === 0) {
              return (
                <div className="col-span-full py-12 flex flex-col items-center justify-center text-slate-400 bg-white rounded-3xl border border-slate-100 border-dashed">
                  <Search className="h-10 w-10 mb-3 text-slate-300" />
                  <p className="text-lg font-bold text-slate-600">No services found</p>
                  <p className="text-sm font-medium">Try adjusting your search or filters.</p>
                </div>
              );
            }

            return filteredServices.map((service) => {
              const firstSub = service.subservice_ids?.[0] || {};
              return (
              <div key={service._id} className="group bg-white rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl transition-all overflow-hidden flex flex-col h-full">
                {/* Image & Badges */}
                <div className="relative h-48 overflow-hidden bg-slate-100">
                  <img
                    src={firstSub.image || "https://images.unsplash.com/photo-1581578731548-c64695ce6958?w=800&auto=format&fit=crop&q=60"}
                    alt={firstSub.subservice_name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute top-4 left-4 flex flex-col gap-2">
                    {service.is_featured && (
                      <span className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white text-[10px] font-black uppercase tracking-wider rounded-full shadow-lg">
                        <Sparkles className="h-3 w-3" />
                        Featured
                      </span>
                    )}
                    {/* <span className={`px-3 py-1.5 ${service.is_available ? "bg-emerald-500" : "bg-slate-500"} text-white text-[10px] font-black uppercase tracking-wider rounded-full shadow-lg`}>
                      {service.is_available ? "Active" : "Offline"}
                    </span> */}
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1 text-amber-500">
                      <Star className="h-4 w-4 fill-current" />
                      <span className="text-sm font-bold">4.8</span>
                      {/* <span className="text-xs text-slate-400 font-medium">(New)</span> */}
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 mb-4 line-clamp-2 min-h-[3.5rem]">
                    {firstSub.subservice_name || "Custom Service"}
                    {service.subservice_ids?.length > 1 && ` (+${service.subservice_ids.length - 1} more)`}
                  </h3>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400 font-medium flex items-center gap-2">
                        <Zap className="h-4 w-4 text-primary" />
                        Starting Price
                      </span>
                      <span className="text-slate-900 font-bold">₹{service.price}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400 font-medium flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary" />
                        Experience
                      </span>
                      <span className="text-slate-900 font-bold">{service.experience} Years</span>
                    </div>
                  </div>

                  {/* Included Sub-Services */}
                  <div className="mb-4 pt-4 border-t border-slate-50">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Included Services</p>
                    <div className="flex flex-wrap gap-1.5">
                      {service.subservice_ids?.map((sub: any) => (
                        <span key={sub._id} className="text-[11px] font-medium bg-slate-100 text-slate-600 px-2 py-1 rounded border border-slate-200">
                          {sub.subservice_name}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Category and Service mentioned at the end */}
                  <div className="mb-4 flex flex-col gap-2">
                    {(() => {
                      const parentService = catalogServices.find(s => s._id === firstSub.service_id);
                      // API returns category_id as a populated object inside the Service model
                      const categoryName = parentService?.category_id?.category_name || "—";
                      return (
                        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 space-y-2">
                          <div className="flex items-center justify-between text-xs font-medium">
                            <span className="text-slate-500">Category</span>
                            <span className="text-slate-900 font-bold">{categoryName}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs font-medium">
                            <span className="text-slate-500">Service</span>
                            <span className="text-slate-900 font-bold">{parentService?.service_name || "—"}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs font-medium">
                            <span className="text-slate-500">Gender</span>
                            <span className="text-slate-900 font-bold capitalize">{parentService?.genderApplicability || "—"}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Service Locations */}
                  <div className="mb-6 pt-3 border-t border-slate-50">
                    <div className="flex items-center gap-1.5 mb-2">
                      <MapPin className="h-3.5 w-3.5 text-primary" />
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Service Locations</p>
                    </div>
                    {service.location_ids && service.location_ids.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {service.location_ids.map((locIdRaw: any) => {
                          // location_ids may be a raw ObjectId string or a partially-populated object
                          const locId = String(locIdRaw?._id || locIdRaw);
                          // Resolve from the frontend map fetched via /api/locations
                          const loc = locationMap.get(locId);
                          const locName = loc?.name || loc?.area_name || `Area (${locId.slice(-6)})`;
                          const locPincode = loc?.pincode ? ` · ${loc.pincode}` : "";
                          return (
                            <span
                              key={locId}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold bg-primary/10 text-primary px-2.5 py-1 rounded-full border border-primary/20"
                            >
                              <MapPin className="h-2.5 w-2.5 shrink-0" />
                              {locName}{locPincode}
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-300 font-medium italic">No locations set — edit to add coverage areas.</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between gap-4">
                    <button 
                      onClick={() => handleToggleClick(service)}
                      className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors hover:opacity-80"
                    >
                      {service.is_available ? (
                        <>
                          <ToggleRight className="h-5 w-5 text-emerald-500" />
                          <span className="text-emerald-500">Active</span>
                        </>
                      ) : (
                        <>
                          <Toggle className="h-5 w-5 text-slate-400" />
                          <span className="text-slate-400">Inactive</span>
                        </>
                      )}
                    </button>
                    
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEditClick(service)}
                        className="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                        title="Edit Service"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
            });
          })()}

          {/* Add Service Placeholder */}
          {/* <button 
            onClick={() => setIsAddModalOpen(true)}
            className="h-full min-h-[400px] rounded-[32px] border-4 border-dashed border-slate-100 flex flex-col items-center justify-center gap-4 bg-slate-50/50 hover:bg-slate-50 transition-all group"
          >
            <div className="h-16 w-16 bg-white rounded-2xl flex items-center justify-center text-slate-300 group-hover:text-primary group-hover:scale-110 transition-all shadow-sm border border-slate-100">
              <Plus className="h-8 w-8" />
            </div>
            <div className="text-center px-6">
              <span className="block text-lg font-bold text-slate-900">Add New Service</span>
              <span className="block text-sm font-medium text-slate-400 mt-1">Scale your business by adding more categories</span>
            </div>
          </button> */}
        </div>
      )}

      <AddServiceModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        existingProviderServices={services}
        existingCatalogServices={catalogServices}
      />

      <EditServiceModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        service={selectedService}
        onSuccess={fetchInitialData}
      />

      <DeleteServiceModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          if (!isEditModalOpen && !isToggleModalOpen) setSelectedService(null);
        }}
        onConfirm={confirmDeleteService}
        serviceName={selectedService?.subservice_ids?.[0]?.subservice_name || "this service"}
        loading={isDeleting}
      />

      <ToggleServiceModal
        isOpen={isToggleModalOpen}
        onClose={() => {
          setIsToggleModalOpen(false);
          if (!isEditModalOpen && !isDeleteModalOpen) setSelectedService(null);
        }}
        onConfirm={confirmToggleService}
        serviceName={selectedService?.subservice_ids?.[0]?.subservice_name || "this service"}
        isCurrentlyActive={selectedService?.is_available || false}
        loading={isToggling}
      />
    </div>
  );
}
