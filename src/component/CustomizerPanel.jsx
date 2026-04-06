import { useState, useContext } from "react";
import "./CustomizerPanel.css";
import { CartContext } from "../CartContext";

export default function CustomizerPanel({ isOpen, onClose }) {
  const { addToCart } = useContext(CartContext);

  const [juice, setJuice] = useState({
    fruits: [],
    base: [], // ✅ multi-select
    extras: [], // ✅ multi-select
  });

  // idle | loading | success
  const [cartStatus, setCartStatus] = useState("idle");

  const fruits = [
    "🍎 Apple",
    "🍌 Banana",
    "🍓 Strawberry",
    "🍍 Pineapple",
    "🥭 Mango",
    "🍇 Grapes",
    "🍉 Watermelon",
    "🍊 Orange",
    "🍒 Cherry",
    "🥝 Kiwi",
    "🥤 Mixed Juice",
  ];

  const bases = ["💧 Water", "🥛 Milk", "🍶 Yogurt"];
  const extras = ["💪 Protein", "🍯 Honey"];

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
  const handleAddToCart = () => {
    if (cartStatus === "loading") return;

    setCartStatus("loading");

    const item = {
      fruits: juice.fruits,
      base: juice.base.length ? juice.base : ["None"],
      extras: juice.extras.length ? juice.extras : ["None"],
      price: price,
    };

    setTimeout(() => {
      addToCart(item);
      setCartStatus("success");

      setTimeout(() => {
        setCartStatus("idle");
      }, 1200);
    }, 1200);
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
            {fruits.map((f) => (
              <button
                key={f}
                className={juice.fruits.includes(f) ? "active" : ""}
                onClick={() => toggle("fruits", f)}
              >
                {f}
              </button>
            ))}
          </div>

          {/* BASE */}
          <p className="section-title">Base</p>
          <div className="chips">
            {bases.map((b) => (
              <button
                key={b}
                className={juice.base.includes(b) ? "active" : ""}
                onClick={() => toggle("base", b)}
              >
                {b}
              </button>
            ))}
          </div>

          {/* EXTRAS */}
          <p className="section-title">Extras</p>
          <div className="chips">
            {extras.map((e) => (
              <button
                key={e}
                className={juice.extras.includes(e) ? "active" : ""}
                onClick={() => toggle("extras", e)}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        {/* 💳 PREVIEW */}
        <div className="preview">
          <p>{juice.fruits.join(" + ") || "Select items"}</p>
          <p>Base: {juice.base.join(", ") || "None"}</p>
          <p>Extras: {juice.extras.join(", ") || "None"}</p> {/* ✅ added */}
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
