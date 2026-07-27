"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { API_URL } from "@/config/api";
import { authFetch } from "@/utils/authFetch";

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
    selected_time_slot?: string,
    package_name?: string
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
      const response = await authFetch(`${API_URL}/cart`);
      if (response && response.ok) {
        const data = await response.json();
        setCart(data);
      }
    } catch (error) {
      console.warn("Failed to fetch cart:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch cart on initial mount (handles page refresh while already logged in)
  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  // Re-fetch cart when the user logs in (token written to localStorage in the same tab
  // fires a custom 'auth-login' event from login.tsx — storage events don't fire same-tab)
  useEffect(() => {
    const handleAuthLogin = () => {
      fetchCart();
    };
    window.addEventListener('auth-login', handleAuthLogin);
    return () => {
      window.removeEventListener('auth-login', handleAuthLogin);
    };
  }, [fetchCart]);

  // ── addToCart ────────────────────────────────────────────────────────────────
  const addToCart = async (
    subserviceId: string,
    quantity: number = 1,
    selected_date?: string,
    selected_time_slot?: string,
    package_name?: string
  ): Promise<{ error?: string; message?: string } | void> => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token || token === "null" || token === "undefined") {
      return { error: "UNAUTHORIZED", message: "Please log in to add items to your cart." };
    }

    // Location stored by Navbar's LocationModal
    const location_id   = typeof window !== "undefined" ? (localStorage.getItem("userLocationId") || undefined) : undefined;
    const location_name = typeof window !== "undefined" ? (localStorage.getItem("userLocation")   || undefined) : undefined;

    try {
      const response = await authFetch(`${API_URL}/cart/add`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subservice_id: subserviceId,
          quantity,
          location_id,
          location_name,
          selected_date,
          selected_time_slot,
          package_name,
        }),
      });

      if (response && response.ok) {
        const data = await response.json();
        setCart(data);
      } else if (response) {
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
      const response = await authFetch(`${API_URL}/cart/update`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ subservice_id: subserviceId, quantity }),
      });
      if (response && response.ok) {
        const data = await response.json();
        setCart(data);
      }
    } catch (error) {
      console.warn("Failed to update cart:", error);
    }
  };

  // ── updateSlot ───────────────────────────────────────────────────────────────
  const updateSlot = async (subserviceId: string, selected_date: string, selected_time_slot: string) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token || token === "null" || token === "undefined") return;

    try {
      const response = await authFetch(`${API_URL}/cart/slot`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ subservice_id: subserviceId, selected_date, selected_time_slot }),
      });
      if (response && response.ok) {
        const data = await response.json();
        setCart(data);
      }
    } catch (error) {
      console.warn("Failed to update slot:", error);
    }
  };

  // ── removeFromCart ───────────────────────────────────────────────────────────
  const removeFromCart = async (subserviceId: string) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token || token === "null" || token === "undefined") return;

    try {
      const response = await authFetch(`${API_URL}/cart/item/${subserviceId}`, {
        method: "DELETE",
      });
      if (response && response.ok) {
        const data = await response.json();
        setCart(data);
      }
    } catch (error) {
      console.warn("Failed to remove from cart:", error);
    }
  };

  // ── clearCart ────────────────────────────────────────────────────────────────
  const clearCart = async () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token || token === "null" || token === "undefined") return;

    try {
      const response = await authFetch(`${API_URL}/cart`, {
        method: "DELETE",
      });
      if (response && response.ok) {
        setCart({ items: [], total_amount: 0 });
      }
    } catch (error) {
      console.warn("Failed to clear cart:", error);
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
