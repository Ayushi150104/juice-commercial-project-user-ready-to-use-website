import { useEffect, useRef, useState, useContext } from "react";
import "./App.css";
import "./index.css";
import Cards from "./component/cards";
import SidebarFr from "./component/SidebarFr";
import CustomizerPanel from "./component/CustomizerPanel";
import Login from "./pages/Login";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { CartContext } from "./CartContext";

import mocktail4 from "./assets/mocktail4.png";
import mocktail1 from "./assets/mocktail1.png";
import mocktail2 from "./assets/mocktail2.png";
import mocktail3 from "./assets/mocktail3.png";

gsap.registerPlugin(ScrollTrigger);

function App() {
  const [user, setUser] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const drinkRef = useRef(null);
  const [theme, setTheme] = useState("purple");

  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);

  // ✅ CART STATE
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const { cartItems, removeFromCart, placeOrder, clearCart, orderHistory } =
    useContext(CartContext);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // ✅ TOTAL PRICE
  const totalPrice = cartItems.reduce((sum, item) => {
    const qty = item.quantity || 1;
    return sum + item.price * qty;
  }, 0);

  const getMocktailImage = (theme) => {
    if (theme === "red") return mocktail2;
    else if (theme === "family") return mocktail3;
    else if (theme === "summer") return mocktail1;
    else return mocktail4;
  };

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user"));
    if (storedUser) {
      setUser(storedUser);
    }
  }, []);

  useEffect(() => {
    document.body.classList.remove(
      "theme-purple",
      "theme-red",
      "theme-family",
      "theme-summer",
    );

    if (theme === "red") document.body.classList.add("theme-red");
    else if (theme === "family") document.body.classList.add("theme-family");
    else if (theme === "summer") document.body.classList.add("theme-summer");
    else document.body.classList.add("theme-purple");
  }, [theme]);

  useEffect(() => {
    if (!drinkRef.current) return;

    ScrollTrigger.getAll().forEach((t) => t.kill());

    const ctx = gsap.context(() => {
      gsap.set("#jar", { width: 300, scale: theme === "purple" ? 2.2 : 1 });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: "#sticky-container",
          start: "top top",
          end: "+=1000",
          scrub: 2,
        },
      });

      tl.from("#juice span", {
        y: 100,
        opacity: 0,
        stagger: 0.2,
      });

      gsap.set(drinkRef.current, {
        xPercent: -60,
        yPercent: -50,
      });

      const isMobile = window.innerWidth <= 768;

      tl.to(drinkRef.current, {
        top: isMobile ? "65%" : "76%",
        left: isMobile ? "30%" : "25%",
        xPercent: isMobile ? -50 : -60,
      });

      tl.to("#bio", { opacity: 1, y: 0 }, 1);
      tl.to("#bio", { opacity: 0, y: -20 }, 2.5);
    });

    return () => ctx.revert();
  }, [theme]);

  const handlePlaceOrder = () => {
    setIsPlacingOrder(true);

    setTimeout(() => {
      placeOrder(cartItems, totalPrice);
      clearCart();

      setIsPlacingOrder(false);
      setOrderPlaced(true);

      setTimeout(() => {
        setOrderPlaced(false);
      }, 2500);
    }, 1800);
  };

  return (
    <>
      {/* 🔐 LOGIN BUTTON */}
      <button
        onClick={() => setShowLogin(true)}
        className={`fixed top-5 right-5 px-4 py-2 rounded text-white transition
        ${isCustomizerOpen ? "z-10 opacity-0 pointer-events-none" : "z-50"}
        bg-yellow-600 hover:bg-yellow-700`}
      >
        {user ? user.name : "Sign Up"}
      </button>

      <Login
        isOpen={showLogin}
        onClose={() => setShowLogin(false)}
        setUser={setUser}
      />

      {/* 🔥 HERO SECTION */}
      <div id="sticky-container">
        <div id="sticky-scene">
          <section id="juice">
            <h1>
              <span>J</span>
              <span>U</span>
              <span>I</span>
              <span>C</span>
              <span>E</span>
            </h1>
          </section>

          <div id="bio">
            <p>
              Expirence the vibrant flavour of our mocktail
              <br />
              Delicious refreshing mocktails 🍹
              <br />
              Perfect for any occasion 🎉
              <br />
              Expertly cafted drinks promise to delight your taste buds!
              <br />
              Elevate your social expirence
              <br />
              Try one today for guilt-free indulgence!
            </p>
          </div>

          <div id="drink" ref={drinkRef}>
            <img
              src={getMocktailImage(theme)}
              id="jar"
              className={theme === "purple" ? "jar-mocktail4" : ""}
              alt="mocktail"
            />
          </div>
        </div>
      </div>

      {/* 🍹 CARDS */}
      <Cards />

      {/* 📌 SIDEBAR */}
      <SidebarFr
        user={user}
        setTheme={setTheme}
        theme={theme}
        openCustomizer={() => setIsCustomizerOpen(true)}
        openCart={() => {
          setIsCartOpen(true);
          setIsHistoryOpen(false);
        }}
        openHistory={() => {
          setIsHistoryOpen(true);
          setIsCartOpen(false);
        }}
      />

      {/* 🎛 CUSTOMIZER */}
      <CustomizerPanel
        isOpen={isCustomizerOpen}
        onClose={() => setIsCustomizerOpen(false)}
      />

      {/* 🛒 CART PANEL */}
      {isCartOpen && (
        <div
          className="cart-panel"
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            width: window.innerWidth <= 768 ? "100vw" : "300px",
            height: "100vh",
            background: "rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            color: "white",
            zIndex: 999,
            padding: "20px",
            paddingBottom: window.innerWidth <= 768 ? "30px" : "20px",
            overflowY: "auto",
            boxShadow: "-8px 0 20px rgba(0,0,0,0.4)",
            borderLeft: "1px solid rgba(255,255,255,0.1)",
            transition: "all 0.3s ease",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "20px",
              paddingBottom: "10px",
              borderBottom: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: "28px",
                fontWeight: "600",
              }}
            >
              🛒 Cart
            </h2>

            <button
              onClick={() => setIsCartOpen(false)}
              style={{
                background: "transparent",
                border: "none",
                color: "white",
                fontSize: "18px",
                cursor: "pointer",
                fontWeight: "600",
              }}
            >
              Close
            </button>
          </div>

          {cartItems.length === 0 && !orderPlaced && !isPlacingOrder ? (
            <p>No items in cart</p>
          ) : (
            <>
              {cartItems.map((item, index) => (
                <div
                  key={index}
                  style={{
                    marginBottom: "15px",
                    position: "relative",
                    padding: "12px",
                    borderRadius: "14px",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    display: "flex",
                    gap: "12px",
                    alignItems: "center",
                  }}
                >
                  {/* ❌ REMOVE BUTTON (top-right) */}
                  <button
                    onClick={() => removeFromCart(index)}
                    style={{
                      position: "absolute",
                      top: "0",
                      right: "0",
                      background: "transparent",
                      color: "white",
                      border: "none",
                      fontSize: "16px",
                      cursor: "pointer",
                    }}
                  >
                    ×
                  </button>

                  {/* IMAGE */}
                  {item.image && (
                    <div
                      style={{
                        width: "75px",
                        height: "85px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                      }}
                    >
                      <img
                        src={item.image}
                        alt={item.name}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                          transform: "scale(1.2)",
                        }}
                      />
                    </div>
                  )}

                  {/* DETAILS */}
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: "600", marginBottom: "4px" }}>
                      {item.fruits ? item.fruits.join(" + ") : item.name}
                    </p>

                    {item.base && (
                      <p style={{ fontSize: "13px", opacity: 0.8 }}>
                        Base: {item.base}
                      </p>
                    )}

                    {item.extras && (
                      <p style={{ fontSize: "13px", opacity: 0.8 }}>
                        Extras: {item.extras.join(" + ")}
                      </p>
                    )}

                    {item.quantity && (
                      <p style={{ fontSize: "13px" }}>Qty: {item.quantity}</p>
                    )}

                    <p style={{ fontWeight: "bold", marginTop: "5px" }}>
                      ₹{item.price * (item.quantity || 1)}
                    </p>
                  </div>

                  <hr />
                </div>
              ))}

              {/* ✅ TOTAL INSIDE CART */}
              {isPlacingOrder && !orderPlaced && cartItems.length > 0 && (
                <h3
                  style={{
                    marginTop: "15px",
                    borderTop: "1px solid gray",
                    paddingTop: "10px",
                    fontWeight: "bold",
                  }}
                >
                  Total: ₹{totalPrice}
                </h3>
              )}
              {!orderPlaced && cartItems.length > 0 && (
                <button
                  style={{
                    width: "100%",
                    padding: "12px",
                    marginTop: "15px",
                    marginBottom: "12px",
                    borderRadius: "12px",
                    border: "none",
                    background: "rgba(255,255,255,0.08)",
                    color: "white",
                    fontSize: "22px",
                    fontWeight: "700",
                    cursor: "default",
                  }}
                >
                  Final Total: ₹
                  {cartItems.reduce(
                    (total, item) => total + item.price * (item.quantity || 1),
                    0,
                  )}
                </button>
              )}
              <button
                onClick={handlePlaceOrder}
                disabled={isPlacingOrder || orderPlaced}
                style={{
                  width: "100%",
                  marginTop: "15px",
                  padding: "12px",
                  borderRadius: "12px",
                  border: "none",
                  background: orderPlaced
                    ? "#15803d"
                    : isPlacingOrder
                      ? "#555"
                      : "#ff7a00",
                  color: "white",
                  fontSize: "16px",
                  fontWeight: "600",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                }}
              >
                {orderPlaced
                  ? "Your order is placed ✅"
                  : isPlacingOrder
                    ? "Proceeding..."
                    : "Place Order"}
              </button>
            </>
          )}
        </div>
      )}
      {isHistoryOpen && (
        <div
          className="cart-panel"
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            width: window.innerWidth <= 768 ? "100vw" : "300px",
            height: "100vh",
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(14px)",
            color: "white",
            zIndex: 999,
            padding: "20px",
            overflowY: "auto",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "20px",
              paddingBottom: "10px",
              borderBottom: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: "32px",
                fontWeight: "700",
                marginLeft: "5px",
              }}
            >
              📜 History
            </h2>

            <button
              onClick={() => setIsHistoryOpen(false)}
              style={{
                background: "transparent",
                border: "none",
                color: "white",
                fontSize: "28px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              ✖
            </button>
          </div>

          {orderHistory.map((order) => (
            <div
              key={order.id}
              style={{
                marginBottom: "40px",
                padding: "15px",
                borderRadius: "16px",
                background: "rgba(255,255,255,0.12)",
                border: "1px solid rgba(255,255,255,0.18)",
                boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
                backdropFilter: "blur(8px)",
              }}
            >
              {/* ORDER DATE */}
              <p
                style={{
                  fontWeight: "600",
                  marginBottom: "12px",
                  borderBottom: "1px solid rgba(255,255,255,0.1)",
                  paddingBottom: "8px",
                }}
              >
                🕒 {order.orderedAt}
              </p>

              {/* ALL ITEMS INSIDE SAME BOX */}
              {order.items.map((item, i) => (
                <div
                  key={i}
                  style={{
                    marginBottom: "12px",
                    padding: "10px",
                    borderRadius: "12px",
                    background: "rgba(255,255,255,0.04)",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  {/* LEFT IMAGE */}
                  {item.image && (
                    <div
                      style={{
                        width: "55px",
                        height: "65px",
                        flexShrink: 0,
                      }}
                    >
                      <img
                        src={item.image}
                        alt={item.name}
                        style={{
                          width:
                            item.name === "Special Mocktail" ? "55px" : "100%",
                          height:
                            item.name === "Special Mocktail" ? "55px" : "100%",
                          objectFit: "contain",
                          transform:
                            item.name === "Special Mocktail"
                              ? "scale(1.15)"
                              : "scale(1)",
                        }}
                      />
                    </div>
                  )}

                  {/* RIGHT DETAILS */}
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: "600", marginBottom: "4px" }}>
                      {item.fruits ? item.fruits.join(" + ") : item.name}
                    </p>

                    {item.base && (
                      <p style={{ fontSize: "13px", opacity: 0.8 }}>
                        Base: {item.base}
                      </p>
                    )}

                    {item.extras && (
                      <p style={{ fontSize: "13px", opacity: 0.8 }}>
                        Extras: {item.extras.join(" + ")}
                      </p>
                    )}

                    {item.quantity && (
                      <p style={{ fontSize: "13px" }}>Qty: {item.quantity}</p>
                    )}

                    <p style={{ fontWeight: "bold" }}>₹{item.price}</p>
                  </div>
                </div>
              ))}

              {/* TOTAL */}
              <div
                style={{
                  marginTop: "16px",
                  padding: "12px 14px",
                  borderRadius: "12px",
                  background: "rgba(255,255,255,0.14)",
                  border: "1px solid rgba(255,255,255,0.18)",
                  boxShadow: "0 4px 10px rgba(0,0,0,0.25)",
                  textAlign: "center",
                }}
              >
                <h4
                  style={{
                    margin: 0,
                    fontSize: "22px",
                    fontWeight: "700",
                    letterSpacing: "0.5px",
                    color: "white",
                  }}
                >
                  Total: ₹{order.total}
                </h4>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default App;
