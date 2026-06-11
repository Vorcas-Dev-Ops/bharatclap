"use client";

import React, { useState, useEffect } from "react";
import { Plus, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import { message } from "antd";
import { API_URL } from "@/config/api";
import Navbar from "@/components/common/Navbar";
import EmptyCart from "./EmptyCart";
import CartItemList from "./CartItemList";
import AddressSelection from "./AddressSelection";
import PaymentMethodSelection from "./PaymentMethodSelection";
import PaymentSummary from "./PaymentSummary";
import AddressModal from "../profile/AddressModal";
import CheckoutSummaryModal from "./CheckoutSummaryModal";
import PaymentGatewayModal from "./PaymentGatewayModal";
import CelebrationModal from "@/components/common/CelebrationModal";
import { useRouter } from "next/navigation";


export default function CartClient() {
  const { cart, itemCount, totalAmount, updateQuantity, removeFromCart, clearCart, loading: cartLoading } = useCart();
  const router = useRouter();
  const [defaultAddress, setDefaultAddress] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<"online" | "cod">("online");
  const [couponCode, setCouponCode] = useState("");
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [lastBookingDetails, setLastBookingDetails] = useState<any>(null);
  const [isBookingLoading, setIsBookingLoading] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    fetchDefaultAddress();
  }, []);

  const fetchDefaultAddress = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const response = await fetch(`${API_URL}/addresses`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (Array.isArray(data)) {
        const defaultAddr = data.find(a => a.is_default) || data[0];
        setDefaultAddress(defaultAddr);
      }
    } catch (error) {
      console.error("Failed to fetch address", error);
    }
  };

  const platformFee = 49;
  const discount = couponCode === "FIXVO50" ? 50 : 0;
  const finalTotal = totalAmount + platformFee - discount;

  const handleCheckout = async () => {
    if (!defaultAddress) {
      messageApi.warning("Please add or select a service address");
      return;
    }
    const hasUnscheduledItems = cart?.items?.some((item: any) => !item.selected_date || !item.selected_time_slot);
    if (hasUnscheduledItems) {
      messageApi.warning("Please select a time slot for all services before checkout");
      return;
    }
    if (!paymentMethod) {
      messageApi.warning("Please select a payment method");
      return;
    }

    setIsSummaryModalOpen(true);
  };

  const handleConfirmBooking = async () => {
    if (paymentMethod === "online") {
      setIsSummaryModalOpen(false);
      setIsPaymentModalOpen(true);
    } else {
      await processBooking();
    }
  };

  const handlePaymentSuccess = async () => {
    setIsPaymentModalOpen(false);
    await processBooking();
  };

  const processBooking = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      setIsBookingLoading(true);

      console.log("Attempting booking at:", `${API_URL}/bookings`);
      const response = await fetch(`${API_URL}/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          address: defaultAddress,
          payment_method: paymentMethod
        })
      });

      if (response.ok) {
        const data = await response.json();
        const bookingDateObj = cart?.items?.[0]?.selected_date ? new Date(cart.items[0].selected_date) : new Date();
        setLastBookingDetails({
          id: data.bookings[0]?.booking_id,
          date: bookingDateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
          slot: cart?.items?.[0]?.selected_time_slot || "",
          address: defaultAddress.address_line
        });
        
        setIsSummaryModalOpen(false);
        setIsSuccessModalOpen(true);
        await clearCart();
      } else {
        const data = await response.json();
        messageApi.error(data.message || "Failed to place booking");
      }
    } catch (error) {
      console.error("Booking error:", error);
      messageApi.error("An error occurred while placing your booking.");
    } finally {
      setIsBookingLoading(false);
    }
  };

  const handleFinalSuccess = () => {
    setIsSuccessModalOpen(false);
    router.push("/user/bookings");
  };

  if (itemCount === 0 && !cartLoading) {
    if (isSuccessModalOpen) {
      return (
        <div className="min-h-screen bg-slate-50/50">
          <Navbar />
          <CelebrationModal
            open={isSuccessModalOpen}
            onClose={handleFinalSuccess}
            title={paymentMethod === "online" ? "Payment Successful!" : "Booking Confirmed!"}
            subtitle={paymentMethod === "online" 
              ? "Your payment was processed and your service is scheduled." 
              : "Your service has been booked successfully via Cash on Delivery."
            }
          />
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-50/50 pb-32 lg:pb-12 pt-12">
        <Navbar />
        <div className="max-w-[1200px] mx-auto px-4 py-4 lg:py-6 text-center">
          <EmptyCart />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 pb-32 lg:pb-12 pt-6">
      {contextHolder}
      <Navbar />

      <div className="max-w-[1200px] mx-auto px-2 py-4 lg:py-6">
        <div className="flex flex-col items-center justify-center text-center mb-6">
          <h1 className="text-4xl font-black text-slate-800 tracking-tight">My Cart</h1>
          <div className="w-16 h-1 bg-[#1D2B83] rounded-full mt-3" />
        </div>


        {/* Info Row - Moved above grid to align columns */}
        <div className="flex items-center justify-between px-1 mb-8">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              {itemCount} {itemCount === 1 ? 'Service' : 'Services'} Selected
            </span>
          </div>
          <Link href="/services">
            <button className="flex items-center gap-2 px-6 py-2.5 bg-white border-2 border-slate-100 rounded-2xl text-slate-600 font-bold text-[11px] uppercase tracking-widest hover:border-[#1D2B83] hover:text-[#1D2B83] hover:shadow-lg hover:shadow-blue-900/5 transition-all group">
              <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
              Add More Services
            </button>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Content */}
          <div className="lg:col-span-8 space-y-6">
            <CartItemList items={cart?.items} removeFromCart={removeFromCart} updateQuantity={updateQuantity} />

            <div>
              <AddressSelection defaultAddress={defaultAddress} onOpenAddressModal={() => setIsAddressModalOpen(true)} />
            </div>

            <div>
              <PaymentMethodSelection paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod} />
            </div>
          </div>



          {/* Sidebar - Payment Summary */}
          <PaymentSummary
            totalAmount={totalAmount}
            platformFee={platformFee}
            discount={discount}
            finalTotal={finalTotal}
            couponCode={couponCode}
            setCouponCode={setCouponCode}
            handleCheckout={handleCheckout}
            messageApi={messageApi}
          />
        </div>
      </div>

      {/* Mobile Sticky CTA */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100 z-50">
        <div className="max-w-md mx-auto flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Total to Pay</p>
            <p className="text-xl font-black text-[#1D2B83]">₹{finalTotal}</p>
          </div>
          <button
            onClick={handleCheckout}
            className="flex-1 h-14 bg-[#1D2B83] text-white font-black uppercase tracking-[0.2em] rounded-2xl shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2"
          >
            Checkout
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <AddressModal
        isOpen={isAddressModalOpen}
        onClose={() => {
          setIsAddressModalOpen(false);
          fetchDefaultAddress(); // Refresh addresses after closing
        }}
      />

      <CheckoutSummaryModal
        isOpen={isSummaryModalOpen}
        onClose={() => setIsSummaryModalOpen(false)}
        cart={cart}
        address={defaultAddress}
        date={cart?.items?.[0]?.selected_date || "today"}
        slot={cart?.items?.[0]?.selected_time_slot || ""}
        paymentMethod={paymentMethod}
        totalAmount={totalAmount}
        platformFee={platformFee}
        discount={discount}
        finalTotal={finalTotal}
        onConfirm={handleConfirmBooking}
        loading={isBookingLoading}
      />

      <PaymentGatewayModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onSuccess={handlePaymentSuccess}
        amount={finalTotal}
      />

      <CelebrationModal
        open={isSuccessModalOpen}
        onClose={handleFinalSuccess}
        title={paymentMethod === "online" ? "Payment Successful!" : "Booking Confirmed!"}
        subtitle={paymentMethod === "online" 
          ? "Your payment was processed and your service is scheduled." 
          : "Your service has been booked successfully via Cash on Delivery."
        }
      />
    </div>
  );
}
