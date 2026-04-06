import { createContext, useState, useEffect } from "react";

export const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState(() => {
    const savedCart = localStorage.getItem("cartItems");
    return savedCart ? JSON.parse(savedCart) : [];
  });

  const [orderHistory, setOrderHistory] = useState(() => {
    const savedHistory = localStorage.getItem("orderHistory");
    return savedHistory ? JSON.parse(savedHistory) : [];
  });

  useEffect(() => {
    localStorage.setItem("cartItems", JSON.stringify(cartItems));
  }, [cartItems]);

  useEffect(() => {
    localStorage.setItem("orderHistory", JSON.stringify(orderHistory));
  }, [orderHistory]);

  const addToCart = (item) => {
    setCartItems((prev) => [...prev, item]);
  };

  const removeFromCart = (indexToRemove) => {
    setCartItems((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const placeOrder = (items, total) => {
    const newOrder = {
      id: Date.now(),
      items: [...items],
      total,
      orderedAt: new Date().toLocaleString(),
      status: "Your order is placed",
    };

    setOrderHistory((prev) => [newOrder, ...prev]);
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
      }}
    >
      {children}
    </CartContext.Provider>
  );
};
