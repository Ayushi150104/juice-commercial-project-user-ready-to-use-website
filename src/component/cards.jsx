import { useEffect, useState } from "react";

import mocktail4 from "./../assets/mocktail4.png";

import "./cards.css";

import Order from "./order";

import api from "../api.js";
import { useContext } from "react";
import { CartContext } from "../CartContext";

const Cards = () => {
  const [activeCard, setActiveCard] = useState(null);
  const [CardList, setCardList] = useState([]);
  const { refreshCart } = useContext(CartContext);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const res = await api.get("/products");
        setCardList(res.data.data.products);
      } catch (error) {
        console.log("Encountered Error : ", error);
      }
    };

    loadProducts();
  }, []);

  // Selected products
  const [selectedItems, setSelectedItems] = useState([]);

  const [showOrder, setShowOrder] = useState(false);

  // Add/remove product from selection
  const handleSelect = (item) => {
    setSelectedItems((prev) => {
      const exists = prev.find((i) => i._id === item._id);

      if (exists) {
        return prev.filter((i) => i._id !== item._id);
      } else {
        return [...prev, item];
      }
    });
  };

  // Add selected products to backend cart
  const handleAddSelectedToCart = async () => {
    const token = localStorage.getItem("token");

    // User must be logged in
    if (!token) {
      console.log("User is not logged in");
      return;
    }

    try {
      for (const item of selectedItems) {
        const cartItem = {
          kind: "product",
          productId: item._id,
          quantity: 1,
        };

        await api.post("/cart/items", cartItem, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }

      await refreshCart();
      setSelectedItems([]);
    } catch (error) {
      console.log(
        "Failed to add products to cart:",
        error.response?.data || error,
      );
    }
  };

  // Close order popup
  const close = () => {
    setShowOrder(false);
    setSelectedItems([]);
    document.body.style.overflow = "auto";
  };

  return (
    <>
      <ul className="cards-container">
        {CardList.map((item) => {
          const image = `http://localhost:5000${item.image}`;

          return (
            <li
              key={item._id}
              className={`card ${activeCard === item._id ? "active" : ""}`}
              onClick={() =>
                setActiveCard(activeCard === item._id ? null : item._id)
              }
            >
              <div
                className={`card-image${
                  item.image === mocktail4 ? " mocktail4-fix" : ""
                }`}
                style={{
                  backgroundImage: `url(${image})`,
                }}
              ></div>

              <div className="card-content">
                <p className="card-title">{item.name}</p>

                <p className="card-desc">
                  Taste the delight from {item.address}
                </p>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(item);
                  }}
                  className="card-btn"
                >
                  {selectedItems.find((i) => i._id === item._id)
                    ? "Selected"
                    : "Add"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {/* GLOBAL BUTTON */}
      {selectedItems.length > 0 && (
        <div
          style={{
            textAlign: "center",
            marginTop: "20px",
          }}
        >
          <button
            className="card-btn"
            onClick={async () => {
              await handleAddSelectedToCart();

              document.body.style.overflow = "hidden";
            }}
          >
            Place Order ({selectedItems.length})
          </button>
        </div>
      )}

      {/* ORDER POPUP */}
      {showOrder && <Order orderDetails={selectedItems} onClose={close} />}
    </>
  );
};

export default Cards;
