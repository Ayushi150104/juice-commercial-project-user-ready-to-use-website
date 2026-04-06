import { useState } from "react";
import "./netflix.css";
import Cards from "../component/cards";
import SidebarFr from "../component/sidebarfr";
import mocktail4 from "../assets/mocktail4.png"; // ✅ MISSING IMPORT FIXED

function Netflix() {
  const [order, setOrder] = useState(false);

  return (
    <>
      {/* ✅ FIXED className */}
      <div className="scroll-watcher"></div>

      <div id="juice" className="relative -left-[17rem] -top-[30rem]">
        <h1>J U I C E</h1>
      </div>

      <div id="mock4">
        {/* ✅ added alt */}
        <img src={mocktail4} id="mocktail4" alt="mocktail" />
      </div>

      <div id="bio">
        <p>
          Experience the vibrant flavor of our mocktail
          <br />
          delicious, refreshing, and alcohol free.
          <br />
          Perfect for any occasion, our <br />
          expertly crafted drinks promise to <br />
          elevate your social experience.
          <br />
          Try one today for a guilt-free delight
        </p>
      </div>

      <Cards />
      <SidebarFr />
    </>
  );
}

export default Netflix;
