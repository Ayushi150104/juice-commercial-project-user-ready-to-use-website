import { createContext, useState, useEffect } from "react";
import api from "./api";
import { data } from "react-router-dom";

export const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const token = localStorage.getItem("token");
  const [cartItems, setCartItems] = useState(() => {
    try {
      const savedCart = localStorage.getItem("cartItems");

      if (!savedCart) return [];

      const parsedCart = JSON.parse(savedCart);

      return Array.isArray(parsedCart) ? parsedCart : [];
    } catch (error) {
      return [];
    }
  });

  const [orderHistory, setOrderHistory] = useState(() => {
    try {
      const savedHistory = localStorage.getItem("orderHistory");
      if (!savedHistory) return [];

      const parsedHistory = JSON.parse(savedHistory);
      return Array.isArray(parsedHistory) ? parsedHistory : [];
    } catch (error) {
      console.error("Error parsing order history from localStorage:", error);
      return []; // Safely fall back to an empty array if data is corrupted
    }
  });

  useEffect(() => {
    if (!token) {
      return;
    }

    const getItems = async () => {
      try {
        const res = await api.get("/cart", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const items = res.data.data.cart.items;
        setOrderHistory(items);
        localStorage.setItem("orderHistory", JSON.stringify(items));
      } catch (error) {
        console.log("Error getting cart:", error);
      }
    };

    const getHistory = async () => {
      try {
        const res = await api.get("/orders/my", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const items = res.data.data.orders;

        setOrderHistory(items);

        localStorage.setItem("orderHistory", JSON.stringify(items));
      } catch (error) {}
    };

    getItems();
    getHistory();
  }, [token]);

  const refreshCart = async () => {
    if (!token) return;

    try {
      const res = await api.get("/cart", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const items = res.data.data.cart.items;

      setCartItems(items);
      localStorage.setItem("cartItems", JSON.stringify(items));
    } catch (error) {
      console.log("Error refreshing cart:", error);
    }
  };

  const refreshHistory = async () => {
    if (!token) return;

    try {
      const res = await api.get("/orders/my", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const items = res.data.data.orders;

      setOrderHistory(items);

      localStorage.setItem("orderHistory", JSON.stringify(items));
    } catch (error) {
      console.log("Error refreshing cart:", error);
    }
  };

  useEffect(() => {
    localStorage.setItem("orderHistory", JSON.stringify(orderHistory));
  }, [orderHistory]);

  const addToCart = (item) => {
    setCartItems((prev) => [...prev, item]);
  };

  const removeFromCart = async (indexToRemove) => {
    setCartItems((prev) => prev.filter((_, index) => index !== indexToRemove));

    try {
      const res = await api.delete(`/cart/items/${indexToRemove.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      refreshCart();
    } catch (error) {
      console.log("Error : ", error);
    }
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const placeOrder = async (items, total) => {
    // Guard check: don't even make the request if the local frontend cart layout is empty
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
        phone: "8653849636", // Ensure this is a string to pass API validation requirements smoothly
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
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // FIX: Push the official server-created order document straight into your state history
      const serverOrder = res.data.data.order;
      setOrderHistory((prev) => [serverOrder, ...prev]);

      // Clear frontend cart states since the backend automatically empties the database cart
      setCartItems([]);
      localStorage.removeItem("cartItems");

      refreshHistory();
    } catch (error) {
      if (error.response) {
        console.error("Server Error:", error.response.data);
        alert(`Order Failed: ${error.response.data.message}`);
      } else {
        console.error("Network Error:", error.message);
      }
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
        refreshCart,
        refreshHistory,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};
