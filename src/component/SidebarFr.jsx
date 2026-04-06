import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { gsap } from "gsap";
import FoodLogo from "./../assets/foodlogo.png";
import profileImage from "./../assets/image.png";

/* 🔥 Collapsible Section */
const CollapsibleSection = (props) => {
  const {
    title,
    items,
    hrSize,
    hrLeft,
    hrTop,
    isDefaultOpen,
    icon,
    setTheme,
    openCustomizer,
    activeItem,
    setActiveItem,
    theme,
  } = props;

  const [show, setShow] = useState(isDefaultOpen || false);

  return (
    <li>
      <div
        onClick={() => setShow(!show)}
        className="cursor-pointer flex items-center justify-center text-lg w-full rounded-md p-2 h-[3rem]
        transition-all duration-300 hover:bg-black/60 hover:scale-[1.02]"
      >
        <div className="mr-5">{icon}</div>
        {title}
      </div>

      {show && (
        <div className="mt-4">
          <ul className="flex flex-col gap-4 mt-2">
            {items.map((item, index) => (
              <li
                key={index}
                onClick={() => {
                  if (item.name === "Customizer") {
                    if (typeof openCustomizer === "function") {
                      openCustomizer();
                    }
                    return;
                  }
                  if (item.name === "Cart") {
                    if (typeof props.openCart === "function") {
                      props.openCart();
                    }
                    return;
                  }
                  if (item.name === "History") {
                    if (typeof props.openHistory === "function") {
                      props.openHistory();
                    }
                    return;
                  }

                  const themeMap = {
                    "Netflix and Chill": "red",
                    "Family time": "family",
                    "Summer Chill": "summer",
                  };

                  setTheme(themeMap[item.name] || "purple");
                  setActiveItem(item.name);

                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className={`
                  rounded-md px-4 py-2 cursor-pointer transition-all duration-300
                  ${
                    activeItem === item.name
                      ? `bg-white/20 scale-[1.05]
                        ${
                          theme === "red"
                            ? "shadow-[0_0_20px_rgba(255,0,0,0.7)]"
                            : ""
                        }
                        ${
                          theme === "family"
                            ? "shadow-[0_0_20px_rgba(255,105,180,0.7)]"
                            : ""
                        }
                        ${
                          theme === "summer"
                            ? "shadow-[0_0_20px_rgba(0,255,150,0.7)]"
                            : ""
                        }
                        ${
                          theme === "purple"
                            ? "shadow-[0_0_20px_rgba(180,0,255,0.7)]"
                            : ""
                        }`
                      : "hover:bg-black/60 hover:scale-[1.02]"
                  }
                `}
              >
                {item.name === "Customizer" ? (
                  <span>{item.name}</span>
                ) : (
                  <Link to={item.href || "#"}>{item.name}</Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
};

/* 🔥 Sidebar */
function SidebarFr(props) {
  const { user, setTheme, theme, openCustomizer } = props;

  const [open, setOpen] = useState(false);
  const [activeItem, setActiveItem] = useState("");
  const sidebarRef = useRef();

  useEffect(() => {
    if (open) {
      gsap.to(sidebarRef.current, { x: 0, duration: 0.5 });
    } else {
      gsap.to(sidebarRef.current, { x: "-100%", duration: 0.5 });
    }
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed top-5 left-5 z-50 bg-black/80 text-white px-4 py-2 rounded"
      >
        ☰
      </button>

      <div
        ref={sidebarRef}
        className={`sidebar text-white w-[24rem] h-[100vh] p-4 fixed top-0 left-0 overflow-y-scroll z-40
        ${theme === "red" ? "theme-red" : ""}
        ${theme === "family" ? "theme-family" : ""}
        ${theme === "summer" ? "theme-summer" : ""}
        ${theme === "purple" ? "theme-purple" : ""}`}
        style={{ transform: "translateX(-100%)" }}
      >
        {/* 🔥 ADDED: Food Wagon Section */}
        <div
          className="relative overflow-hidden rounded-xl py-4 border mb-4
  shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-xl bg-white/10"
        >
          <div className="flex items-center justify-center gap-1 p-4">
            <div
              className="h-16 w-16 rounded-md bg-cover bg-center"
              style={{ backgroundImage: `url(${FoodLogo})` }}
            ></div>

            <div>
              <p className="font-semibold text-lg">Food Wagon</p>
            </div>
          </div>

          <hr />
        </div>

        <ul className="mt-6 space-y-6">
          <CollapsibleSection
            title="Playground"
            items={[
              { name: "Home" },
              { name: "Customizer" },
              { name: "Cart" },
              { name: "History" },
            ]}
            isDefaultOpen={true}
            setTheme={setTheme}
            openCustomizer={openCustomizer}
            openCart={props.openCart}
            openHistory={props.openHistory}
            activeItem={activeItem}
            setActiveItem={setActiveItem}
            theme={theme}
          />

          <CollapsibleSection
            title="What's on your mind"
            items={[
              { name: "Netflix and Chill", href: "/netflix" },
              { name: "Family time" },
              { name: "Summer Chill" },
            ]}
            setTheme={setTheme}
            openCustomizer={openCustomizer}
            activeItem={activeItem}
            setActiveItem={setActiveItem}
            theme={theme}
          />
        </ul>
        {/* 🔥 ADDED: Footer */}
        <div className="mt-10">
          <hr className="mb-4" />

          <div className="flex items-center gap-4">
            <div
              className="h-16 w-16 rounded-full bg-cover bg-center"
              style={{ backgroundImage: `url(${profileImage})` }}
            ></div>

            <div>
              <p className="font-semibold text-lg">
                {user ? user.name : "Guest"}
              </p>

              <p className="text-sm text-gray-400">
                {user ? user.email : "Not logged in"}
              </p>
              {/* ✅ ADD THIS BUTTON */}
              {user && (
                <button
                  onClick={() => {
                    localStorage.removeItem("user");
                    window.location.reload();
                  }}
                  className="text-red-400 text-sm mt-2 hover:text-red-500"
                >
                  Logout
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default SidebarFr;
