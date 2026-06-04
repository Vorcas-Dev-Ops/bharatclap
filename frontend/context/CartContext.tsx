"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { API_URL } from "@/config/api";

interface CartItem {
  subservice_id: {
    _id: string;
    subservice_name: string;
    base_price: number;
    image?: string;
  };
  quantity: number;
  price_snapshot: number;
  selected_date?: string;
  selected_time_slot?: string;
}

interface CartContextType {
  cart: any | null;
  itemCount: number;
  totalAmount: number;
  loading: boolean;
  addToCart: (
    subserviceId: string,
    quantity?: number,
    selected_date?: string,
    selected_time_slot?: string
  ) => Promise<{ error?: string; message?: string } | void>;
  updateQuantity: (subserviceId: string, quantity: number) => Promise<void>;
  updateSlot: (subserviceId: string, selected_date: string, selected_time_slot: string) => Promise<void>;
  removeFromCart: (subserviceId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchCart = useCallback(async () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token || token === "null" || token === "undefined") {
      setCart(null);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/cart`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setCart(data);
      }
    } catch (error) {
      console.error("Failed to fetch cart:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  // ── addToCart ────────────────────────────────────────────────────────────────
  const addToCart = async (
    subserviceId: string,
    quantity: number = 1,
    selected_date?: string,
    selected_time_slot?: string
  ): Promise<{ error?: string; message?: string } | void> => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token || token === "null" || token === "undefined") return;

    // Location stored by Navbar's LocationModal
    const location_id   = typeof window !== "undefined" ? (localStorage.getItem("userLocationId") || undefined) : undefined;
    const location_name = typeof window !== "undefined" ? (localStorage.getItem("userLocation")   || undefined) : undefined;

    try {
      const response = await fetch(`${API_URL}/cart/add`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          subservice_id: subserviceId,
          quantity,
          location_id,
          location_name,
          selected_date,
          selected_time_slot,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setCart(data);
      } else {
        const errData = await response.json();
        if (errData.error === "NO_PROVIDER_AVAILABLE") {
          return { error: "NO_PROVIDER_AVAILABLE", message: errData.message };
        }
        console.error("Failed to add to cart:", errData.message);
      }
    } catch (error) {
      console.error("Failed to add to cart:", error);
    }
  };

  // ── updateQuantity ───────────────────────────────────────────────────────────
  const updateQuantity = async (subserviceId: string, quantity: number) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token || token === "null" || token === "undefined") return;

    try {
      const response = await fetch(`${API_URL}/cart/update`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ subservice_id: subserviceId, quantity }),
      });
      if (response.ok) {
        const data = await response.json();
        setCart(data);
      }
    } catch (error) {
      console.error("Failed to update cart:", error);
    }
  };

  // ── updateSlot ───────────────────────────────────────────────────────────────
  const updateSlot = async (subserviceId: string, selected_date: string, selected_time_slot: string) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token || token === "null" || token === "undefined") return;

    try {
      const response = await fetch(`${API_URL}/cart/slot`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ subservice_id: subserviceId, selected_date, selected_time_slot }),
      });
      if (response.ok) {
        const data = await response.json();
        setCart(data);
      }
    } catch (error) {
      console.error("Failed to update slot:", error);
    }
  };

  // ── removeFromCart ───────────────────────────────────────────────────────────
  const removeFromCart = async (subserviceId: string) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token || token === "null" || token === "undefined") return;

    try {
      const response = await fetch(`${API_URL}/cart/item/${subserviceId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setCart(data);
      }
    } catch (error) {
      console.error("Failed to remove from cart:", error);
    }
  };

  // ── clearCart ────────────────────────────────────────────────────────────────
  const clearCart = async () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token || token === "null" || token === "undefined") return;

    try {
      const response = await fetch(`${API_URL}/cart`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        setCart({ items: [], total_amount: 0 });
      }
    } catch (error) {
      console.error("Failed to clear cart:", error);
    }
  };

  const itemCount = cart?.items?.length || 0;
  const totalAmount = cart?.total_amount || 0;

  return (
    <CartContext.Provider
      value={{
        cart,
        itemCount,
        totalAmount,
        loading,
        addToCart,
        updateQuantity,
        updateSlot,
        removeFromCart,
        clearCart,
        refreshCart: fetchCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
};
