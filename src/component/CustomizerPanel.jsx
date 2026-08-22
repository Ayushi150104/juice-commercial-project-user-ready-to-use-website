import { useState, useContext, useEffect } from "react";
import "./CustomizerPanel.css";
import { CartContext } from "../CartContext";
import api from "../api";

export default function CustomizerPanel({ isOpen, onClose }) {
  const { refreshCart } = useContext(CartContext);

  const [juice, setJuice] = useState({
    fruits: [],
    base: [], // ✅ multi-select
    extras: [], // ✅ multi-select
  });

  // idle | loading | success
  const [cartStatus, setCartStatus] = useState("idle");

  const [fruits, setFruits] = useState([]);

  const [bases, setBases] = useState([]);
  const [extras, setExtras] = useState([]);

  useEffect(() => {
    const loadCustomizerOptions = async () => {
      try {
        const res = await api.get("/customizer/options");
        const data = res.data.data;

        setBases(data.bases);
        setExtras(data.extras);
        setFruits(data.fruits);
      } catch (error) {
        console.log("Encountered Error : ", error);
      }
    };
    loadCustomizerOptions();
  }, []);

  // ✅ universal multi-select toggle
  const toggle = (type, value) => {
    setJuice((prev) => ({
      ...prev,
      [type]: prev[type].includes(value)
        ? prev[type].filter((i) => i !== value)
        : [...prev[type], value],
    }));
  };

  // ✅ Add to cart
  const handleAddToCart = async () => {
    if (cartStatus === "loading") return;

    setCartStatus("loading");

    try {
      const item = {
        kind: "custom",
        fruits: juice.fruits.map((f) => f.label),
        base: juice.base.map((b) => b.label),
        extras: juice.extras.map((e) => e.label),
        quantity: 1,
      };

      const res = await api.post("/cart/items", item, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      setCartStatus("success");

      setTimeout(() => {
        setCartStatus("idle");
      }, 1200);
      await refreshCart();
    } catch (error) {
      console.error("Failed to add custom item:", error);
      setCartStatus("idle");
    }
  };

  // 💰 Price logic
  let price = 0 + juice.fruits.length * 20;
  if (juice.fruits.includes("🥤 Mixed Juice")) price += 100;

  return (
    <>
      {isOpen && <div className="overlay" onClick={onClose}></div>}

      <div className={`panel ${isOpen ? "open" : ""}`}>
        {/* 🔥 HEADER */}
        <div className="header">
          <h2>✨ Customizer</h2>
          <button onClick={onClose}>✖</button>
        </div>

        {/* 🍓 CONTENT */}
        <div className="content">
          {/* FRUITS */}
          <p className="section-title">Fruits</p>
          <div className="chips">
            {fruits.map((f, idx) => (
              <button
                key={f._id}
                className={juice.fruits.includes(f) ? "active" : ""}
                onClick={() => toggle("fruits", f)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* BASE */}
          <p className="section-title">Base</p>
          <div className="chips">
            {bases.map((b) => (
              <button
                key={b._id}
                className={juice.base.includes(b) ? "active" : ""}
                onClick={() => toggle("base", b)}
              >
                {b.label}
              </button>
            ))}
          </div>

          {/* EXTRAS */}
          <p className="section-title">Extras</p>
          <div className="chips">
            {extras.map((e) => (
              <button
                key={e._id}
                className={juice.extras.includes(e) ? "active" : ""}
                onClick={() => toggle("extras", e)}
              >
                {e.label}
              </button>
            ))}
          </div>
        </div>

        {/* 💳 PREVIEW */}
        <div className="preview">
          <p>
            {juice.fruits.map((i) => i.label).join(" + ") || "Select items"}
          </p>
          <p>Base: {juice.base.map((i) => i.label).join(", ") || "None"}</p>
          <p>
            Extras: {juice.extras.map((i) => i.label).join(", ") || "None"}
          </p>{" "}
          {/* ✅ added */}
          <p className="price">₹{price}</p>
          {/* 🛒 BUTTON */}
          <button
            onClick={handleAddToCart}
            className="cart-btn"
            disabled={cartStatus === "loading"}
          >
            <span className="btn-content">
              {cartStatus === "idle" && (
                <>
                  🛒 <span>Add to Cart</span>
                </>
              )}

              {cartStatus === "loading" && (
                <>
                  <span className="spinner"></span>
                  <span>Adding...</span>
                </>
              )}

              {cartStatus === "success" && (
                <>
                  <span className="tick">✔</span>
                  <span>Added</span>
                </>
              )}
            </span>
          </button>
        </div>
      </div>
    </>
  );
}
