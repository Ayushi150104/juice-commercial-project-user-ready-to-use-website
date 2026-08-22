import { useEffect, useState, useContext } from "react";
import mocktail4 from "./../assets/mocktail4.png";
import "./cards.css";
import Order from "./order";
import api from "../api.js";
import { CartContext } from "../CartContext";

const Cards = () => {
  const [activeCard, setActiveCard] = useState(null);
  const [CardList, setCardList] = useState([]);
  const { refreshCart } = useContext(CartContext);

  // States for products, popups, and selection
  const [selectedItems, setSelectedItems] = useState([]);
  const [checkoutItems, setCheckoutItems] = useState([]); // Keeps items safe for popup when selection wipes
  const [showOrder, setShowOrder] = useState(false);

  // 🔥 NEW STATE: Tracks which item IDs are currently displaying the "Added!" feedback flash
  const [addedIndicatorIds, setAddedIndicatorIds] = useState([]);

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

  // Add/remove product from selection + flash indicator
  const handleSelect = (item) => {
    setSelectedItems((prev) => {
      const exists = prev.find((i) => i._id === item._id);

      if (exists) {
        // Removing item: Just filter it out
        return prev.filter((i) => i._id !== item._id);
      } else {
        // Adding item: Trigger the temporary green visual indicator flash
        setAddedIndicatorIds((prevIds) => [...prevIds, item._id]);

        // Remove the flash class automatically after 1.5 seconds
        setTimeout(() => {
          setAddedIndicatorIds((prevIds) =>
            prevIds.filter((id) => id !== item._id),
          );
        }, 1500);

        return [...prev, item];
      }
    });
  };

  // Add selected products to backend cart
  const handleAddSelectedToCart = async (itemsToSubmit) => {
    const token = localStorage.getItem("token");
    if (!token) {
      console.log("User is not logged in");
      return;
    }

    try {
      // Fire requests in parallel to prevent sequential network lag loops
      const cartPromises = itemsToSubmit.map((item) => {
        const cartItem = {
          kind: "product",
          productId: item._id,
          quantity: 1,
        };
        return api.post("/cart/items", cartItem, {
          headers: { Authorization: `Bearer ${token}` },
        });
      });

      await Promise.all(cartPromises);
      await refreshCart();
    } catch (error) {
      console.log(
        "Failed to add products to cart:",
        error.response?.data || error,
      );
    }
  };

  const close = () => {
    setShowOrder(false);
    setCheckoutItems([]);
    document.body.style.overflow = "auto";
  };

  return (
    <>
      <ul className="cards-container">
        {CardList.map((item) => {
          const image = `https://juice-commercial-project-user-ready-to-n2gk.onrender.com${item.image}`;

          // Helper flags for state evaluation
          const isSelected = selectedItems.find((i) => i._id === item._id);
          const isJustAdded = addedIndicatorIds.includes(item._id);

          return (
            <li
              key={item._id}
              className={`card ${activeCard === item._id ? "active" : ""}`}
              onClick={() =>
                setActiveCard(activeCard === item._id ? null : item._id)
              }
            >
              <div
                className={`card-image${item.image === mocktail4 ? " mocktail4-fix" : ""}`}
                style={{ backgroundImage: `url(${image})` }}
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
                  // Dynamic class turns the button green when 'isJustAdded' is active
                  className={`card-btn ${isJustAdded ? "indicator-added" : ""}`}
                >
                  {isJustAdded ? "Added! ✓" : isSelected ? "Selected" : "Add"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {/* GLOBAL BUTTON */}
      {selectedItems.length > 0 && (
        <div style={{ textAlign: "center", marginTop: "20px" }}>
          <button
            className="card-btn"
            onClick={async () => {
              const itemsToSubmit = [...selectedItems];
              setCheckoutItems(itemsToSubmit); // Lock items for the modal checkout view
              setSelectedItems([]); // Clear selections immediately for Optimistic UI feedback

              setShowOrder(true); // Open modal popup window layout
              document.body.style.overflow = "hidden";

              await handleAddSelectedToCart(itemsToSubmit);
            }}
          >
            Place Order ({selectedItems.length})
          </button>
        </div>
      )}

      {/* ORDER POPUP */}
      {showOrder && <Order orderDetails={checkoutItems} onClose={close} />}
    </>
  );
};

export default Cards;
