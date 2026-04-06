import { useState, useEffect, useContext } from "react";
import "./order.css";
import { CartContext } from "../CartContext";

const Order = ({ orderDetails, onClose }) => {
  const { addToCart } = useContext(CartContext);
  const [showLoader, setShowLoader] = useState(false);
  const [progress, setProgress] = useState(0);
  const [orderConfirmed, setOrderConfirmed] = useState(false);

  // Local items state (for remove feature)
  const [items, setItems] = useState(orderDetails);

  // per-item quantity
  const [quantities, setQuantities] = useState({});

  const quantityList = [1, 2, 3, 4, 5, 6];

  const close = () => {
    onClose();
  };

  // REMOVE ITEM
  const handleRemove = (id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  // HANDLE QUANTITY CHANGE
  const handleQuantityChange = (id, value) => {
    setQuantities((prev) => ({
      ...prev,
      [id]: value,
    }));
  };

  const handleOrder = () => {
    setShowLoader(true);
    setProgress(0);

    let val = 0;

    const interval = setInterval(() => {
      val += 10;
      setProgress(val);

      if (val >= 100) {
        clearInterval(interval);

        setTimeout(() => {
          // ADD ALL ITEMS TO CART
          items.forEach((item) => {
            const qty = quantities[item.id] || 1;

            addToCart({
              name: item.name,
              price: item.price,
              image: item.image,
              quantity: qty,
            });
          });

          setShowLoader(false);
          setOrderConfirmed(true);

          setTimeout(() => {
            setOrderConfirmed(false);
            close();
          }, 1200);
        }, 400);
      }
    }, 100);
  };

  // UPDATED TOTAL
  const total = items.reduce((sum, item) => {
    const qty = quantities[item.id] || 1;
    return sum + item.price * qty;
  }, 0);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  return (
    <>
      {/* Overlay */}
      <div className="overlay" onClick={close}></div>

      {/* Modal */}
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
            {/* ITEMS */}
            {items.map((item) => {
              const qty = quantities[item.id] || 1;

              return (
                <div
                  key={item.id}
                  className="order-item"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    marginBottom: "15px",
                    position: "relative",
                  }}
                >
                  {/* REMOVE BUTTON */}
                  <button
                    onClick={() => handleRemove(item.id)}
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

                  {/* IMAGE */}
                  <img
                    src={item.image}
                    alt={item.name}
                    className="mocktail-img"
                  />

                  {/* INFO */}
                  <div style={{ flex: 1, textAlign: "left" }}>
                    <p className="order-name">{item.name}</p>
                    <p>{item.address}</p>
                    <p>₹ {item.price}</p>

                    {/* QUANTITY */}
                    <div className="quantity" style={{ marginTop: "5px" }}>
                      <span>Qty: {qty}</span>

                      <div className="quantity-list">
                        {quantityList.map((q) => (
                          <button
                            key={q}
                            onClick={() => handleQuantityChange(item.id, q)}
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

            {/* TOTAL */}
            <p className="price">Total: ₹ {total}</p>

            {/* Buttons */}
            <div className="order-buttons">
              <button className="btn-primary" onClick={handleOrder}>
                Proceed
              </button>

              <button className="btn-danger" onClick={close}>
                Cancel
              </button>
            </div>
          </>
        )}
      </div>

      {/* Loader */}
      {showLoader && (
        <div className="loader">
          <p>Adding to cart...</p>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Success */}
      {orderConfirmed && (
        <div className="success">
          <p>Added to cart! 🎉</p>
        </div>
      )}
    </>
  );
};

export default Order;
