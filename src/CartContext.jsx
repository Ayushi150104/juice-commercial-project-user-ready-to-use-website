import { createContext, useState, useEffect } from "react";
import api from "./api";

export const CartContext = createContext();

export const CartProvider = ({ children }) => {
  // 1. FIXED: Store the token in React state so changes trigger component updates
  const [token, setToken] = useState(() => localStorage.getItem("token"));

  const [cartItems, setCartItems] = useState(() => {
    try {
      const savedCart = localStorage.getItem("cartItems");
      if (!savedCart) return [];
      const parsedCart = JSON.parse(savedCart);
      return Array.isArray(parsedCart) ? parsedCart : [];
    } catch {
      return [];
    }
  });

  const [orderHistory, setOrderHistory] = useState(() => {
    try {
      const savedHistory = localStorage.getItem("orderHistory");
      if (!savedHistory) return [];
      const parsedHistory = JSON.parse(savedHistory);
      return Array.isArray(parsedHistory) ? parsedHistory : [];
    } catch {
      return [];
    }
  });

  // 2. FIXED: Create a login function your login/register views can call to sync state immediately
  const loginSync = (newToken) => {
    localStorage.setItem("token", newToken);
    setToken(newToken);
  };

  // Logout sync helper
  const logoutSync = () => {
    localStorage.clear();
    setToken(null);
    setCartItems([]);
    setOrderHistory([]);
  };

  const refreshCart = async () => {
    const activeToken = token || localStorage.getItem("token");
    if (!activeToken) return;

    try {
      const res = await api.get("/cart", {
        headers: { Authorization: `Bearer ${activeToken}` },
      });
      const items = res.data?.data?.cart?.items || [];
      setCartItems(items);
      localStorage.setItem("cartItems", JSON.stringify(items));
    } catch (error) {
      console.error("Error refreshing cart:", error);
    }
  };

  const refreshHistory = async () => {
    const activeToken = token || localStorage.getItem("token");
    if (!activeToken) return;

    try {
      const res = await api.get("/orders/my", {
        headers: { Authorization: `Bearer ${activeToken}` },
      });
      // Handle fallback variations safely
      const items = res.data?.orders || res.data?.data?.orders || [];
      setOrderHistory(items);
      localStorage.setItem("orderHistory", JSON.stringify(items));
    } catch (error) {
      console.error("Error refreshing order history:", error);
    }
  };

  // 3. FIXED: Single, clean effect that fires the moment the token state updates
  useEffect(() => {
    if (token) {
      refreshCart();
      refreshHistory();
    }
  }, [token]);

  // 4. FIXED: Keep a continuous listener for storage events (handles cross-tab changes or raw storage additions)
  useEffect(() => {
    const handleStorageChange = () => {
      const currentToken = localStorage.getItem("token");
      if (currentToken !== token) {
        setToken(currentToken);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    // Interval heartbeat to catch same-tab token additions quickly
    const heartbeat = setInterval(handleStorageChange, 1000);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(heartbeat);
    };
  }, [token]);

  const addToCart = (item) => {
    setCartItems((prev) => [...prev, item]);
  };

  const removeFromCart = async (indexToRemove) => {
    setCartItems((prev) => prev.filter((_, index) => index !== indexToRemove));
    try {
      await api.delete(`/cart/items/${indexToRemove.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      refreshCart();
    } catch (error) {
      console.error("Error removing item:", error);
    }
  };

  const clearCart = () => {
    setCartItems([]);
    localStorage.removeItem("cartItems");
  };

  const placeOrder = async (items, total) => {
    if (!items || items.length === 0) {
      alert("Your shopping cart is empty!");
      return;
    }

    const userString = localStorage.getItem("user");
    const user = userString ? JSON.parse(userString) : {};

    const newOrder = {
      customer: {
        name: user.name || "Guest",
        email: user.email || "",
        phone: "8653849636",
      },
      deliveryAddress: {
        line1: "12 MG Road",
        line2: "Flat 4B",
        landmark: "Near the park",
        city: "Pune",
        state: "Maharashtra",
        pincode: "411001",
      },
      note: "No ice please",
    };

    try {
      const res = await api.post("/orders", newOrder, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const serverOrder = res.data?.data?.order;
      if (serverOrder) {
        setOrderHistory((prev) => [serverOrder, ...prev]);
      }

      setCartItems([]);
      localStorage.removeItem("cartItems");
      refreshHistory();
    } catch (error) {
      console.error(
        "Order process failure:",
        error.response?.data || error.message,
      );
      alert(`Order Failed: ${error.response?.data?.message || "Server Error"}`);
    }
  };

  return (
    <CartContext.Provider
      value={{
        cartItems,
        addToCart,
        removeFromCart,
        clearCart,
        placeOrder,
        orderHistory,
        setOrderHistory,
        refreshCart,
        refreshHistory,
        loginSync, // Exposed so login views can notify the provider
        logoutSync, // Clean logout wrapper
      }}
    >
      {children}
    </CartContext.Provider>
  );
};
