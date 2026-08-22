import { useState, useEffect, useContext } from "react";
import "./order.css";
import { CartContext } from "../CartContext";
import api from "../api.js";

const Order = ({ orderDetails, onClose }) => {
  // Pull core state controls from your verified context provider
  const { placeOrder, refreshCart } = useContext(CartContext);

  const [showLoader, setShowLoader] = useState(false);
  const [progress, setProgress] = useState(0);
  const [orderConfirmed, setOrderConfirmed] = useState(false);
  const [loaderMessage, setLoaderMessage] = useState("Adding to cart...");

  // Manage checkout items locally
  const [items, setItems] = useState(orderDetails);
  const [quantities, setQuantities] = useState({});

  const quantityList = [1, 2, 3, 4, 5, 6];

  const handleRemove = (id) => {
    setItems((prev) => prev.filter((item) => item._id !== id));
  };

  const handleQuantityChange = (id, value) => {
    setQuantities((prev) => ({
      ...prev,
      [id]: value,
    }));
  };

  const handleOrder = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      alert("Please log in to check out!");
      return;
    }

    setShowLoader(true);
    setProgress(10);
    setLoaderMessage("Adding items to database cart...");

    try {
      // 1. STEP ONE: Add items to backend database cart in parallel
      const cartPromises = items.map((item) => {
        const qty = quantities[item._id] || 1;
        return api.post(
          "/cart/items",
          {
            kind: "product",
            productId: item._id,
            quantity: qty,
          },
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
      });

      // Wait for all cart insertions to write completely
      await Promise.all(cartPromises);
      setProgress(50);
      setLoaderMessage("Cart synced! Finalising checkout request...");

      // Update the main header cart layout states
      await refreshCart();
      setProgress(75);

      // Format to track pricing attributes safely
      const formattedItems = items.map((item) => ({
        productId: item._id,
        name: item.name,
        unitPrice: item.unitPrice || item.price || 0,
        quantity: quantities[item._id] || 1,
      }));

      // 2. STEP TWO: Dispatch the primary checkout payload
      // Your backend documentation confirms it snapshots this active cart,
      // writes the order, processes the mock payment, and handles cleanup!
      await placeOrder(formattedItems, total);

      setProgress(100);
      setShowLoader(false);
      setOrderConfirmed(true);

      setTimeout(() => {
        setOrderConfirmed(false);
        onClose();
      }, 1200);
    } catch (error) {
      clearInterval(interval);
      setShowLoader(false);
      console.error(
        "Order processing sequence failed:",
        error.response?.data || error.message,
      );
      alert(
        `Checkout Failed: ${error.response?.data?.message || "Server error occurred"}`,
      );
    }
  };

  const total = items.reduce((sum, item) => {
    const qty = quantities[item._id] || 1;
    const priceValue = item.unitPrice || item.price || 0;
    return sum + priceValue * qty;
  }, 0);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  return (
    <>
      <div className="overlay" onClick={onClose}></div>

      <div className="order-modal">
        <h2 className="order-title">Order Details</h2>

        {items.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "30px 10px",
              fontSize: "18px",
              fontWeight: "600",
              color: "white",
            }}
          >
            No Items are selected
          </div>
        ) : (
          <>
            {items.map((item) => {
              const qty = quantities[item._id] || 1;
              const displayPrice = item.unitPrice || item.price || 0;
              const image = `https://juice-commercial-project-user-ready-to-n2gk.onrender.com${item.image}`;

              return (
                <div
                  key={item._id}
                  className="order-item"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    marginBottom: "15px",
                    position: "relative",
                  }}
                >
                  <button
                    onClick={() => handleRemove(item._id)}
                    style={{
                      position: "absolute",
                      top: "6px",
                      right: "8px",
                      background: "transparent",
                      border: "none",
                      color: "white",
                      fontSize: "14px",
                      cursor: "pointer",
                      opacity: 0.8,
                    }}
                  >
                    ❌
                  </button>

                  <img src={image} className="mocktail-img" alt={item.name} />

                  <div style={{ flex: 1, textAlign: "left" }}>
                    <p className="order-name">{item.name}</p>
                    <p className="text-xs opacity-75">{item.address}</p>
                    <p className="text-sm font-semibold">₹ {displayPrice}</p>

                    <div className="quantity" style={{ marginTop: "5px" }}>
                      <span>Qty: {qty}</span>

                      <div className="quantity-list">
                        {quantityList.map((q) => (
                          <button
                            key={q}
                            onClick={() => handleQuantityChange(item._id, q)}
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            <p className="price">Total: ₹ {total}</p>

            <div className="order-buttons">
              <button className="btn-primary" onClick={handleOrder}>
                Proceed
              </button>
              <button className="btn-danger" onClick={onClose}>
                Cancel
              </button>
            </div>
          </>
        )}
      </div>

      {/* LOADER */}
      {showLoader && (
        <div className="loader">
          {/* Dynamic text changes to show users exactly what phase the background process is in */}
          <p>{loaderMessage}</p>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* SUCCESS MODAL POPUP */}
      {orderConfirmed && (
        <div className="success">
          <p>Order Placed Successfully! 🎉</p>
        </div>
      )}
    </>
  );
};

export default Order;
