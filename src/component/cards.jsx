import { useState } from "react";

import mocktail1 from "./../assets/mocktail1.png";
import mocktail2 from "./../assets/mocktail2.png";
import mocktail3 from "./../assets/mocktail3.png";
import mocktail4 from "./../assets/mocktail4.png";
import "./cards.css";
import Order from "./order";

const Cards = () => {
  const [activeCard, setActiveCard] = useState(null);
  const [CardList] = useState([
    {
      id: "1",
      image: mocktail1,
      name: "Nimbu Pani",
      address: "123 Street A",
      time: "30 min",
      price: 55,
    },
    {
      id: "2",
      image: mocktail2,
      name: "Orange Juice",
      address: "456 Street B",
      time: "15 min",
      price: 50,
    },
    {
      id: "3",
      image: mocktail3,
      name: "Strawberry Juice",
      address: "789 Street C",
      time: "20 min",
      price: 35,
    },
    {
      id: "4",
      image: mocktail4,
      name: "Special Mocktail",
      address: "101 Street D",
      time: "3:00 PM",
      price: 40,
    },
  ]);

  // ✅ UPDATED
  const [selectedItems, setSelectedItems] = useState([]);
  const [showOrder, setShowOrder] = useState(false);

  // ✅ UPDATED (selection instead of direct order)
  const handleSelect = (item) => {
    setSelectedItems((prev) => {
      const exists = prev.find((i) => i.id === item.id);
      if (exists) {
        return prev.filter((i) => i.id !== item.id);
      } else {
        return [...prev, item];
      }
    });
  };

  // ✅ UPDATED
  const close = () => {
    setShowOrder(false);
    setSelectedItems([]);
    document.body.style.overflow = "auto";
  };

  return (
    <>
      <ul className="cards-container">
        {CardList.map((item) => (
          <li
            key={item.id}
            className={`card ${activeCard === item.id ? "active" : ""}`}
            onClick={() =>
              setActiveCard(activeCard === item.id ? null : item.id)
            }
          >
            <div
              className={`card-image${
                item.image === mocktail4 ? " mocktail4-fix" : ""
              }`}
              style={{ backgroundImage: `url(${item.image})` }}
            ></div>

            <div className="card-content">
              <p className="card-title">{item.name}</p>

              <p className="card-desc">Taste the delight from {item.address}</p>

              {/* ✅ UPDATED BUTTON */}
              <button onClick={() => handleSelect(item)} className="card-btn">
                {selectedItems.find((i) => i.id === item.id)
                  ? "Selected"
                  : "Add"}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {/* ✅ NEW GLOBAL BUTTON */}
      {selectedItems.length > 0 && (
        <div style={{ textAlign: "center", marginTop: "20px" }}>
          <button
            className="card-btn"
            onClick={() => {
              setShowOrder(true);
              document.body.style.overflow = "hidden";
            }}
          >
            Place Order ({selectedItems.length})
          </button>
        </div>
      )}

      {/* ✅ UPDATED */}
      {showOrder && <Order orderDetails={selectedItems} onClose={close} />}
    </>
  );
};

export default Cards;
