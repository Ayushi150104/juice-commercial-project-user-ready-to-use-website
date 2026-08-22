import { useContext, useState } from "react";
import api from "../api";
import { CartContext } from "../CartContext";

export default function Login({ isOpen, onClose, setUser, setCurLog }) {
  const [isLogin, setIsLogin] = useState(true);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");

  // FIXED: Destructure loginSync from your CartContext to handle the token lifetime lifecycle
  const { loginSync } = useContext(CartContext);

  if (!isOpen) return null;

  const isStrongPassword = (pass) => {
    return pass.length >= 6 && /[A-Z]/.test(pass) && /[0-9]/.test(pass);
  };

  const handleSubmit = async () => {
    setError("");

    if (!email || !password || (!isLogin && !name)) {
      setError("Please fill all fields");
      return;
    }

    if (!isStrongPassword(password)) {
      setError("Password must be 6+ chars, include 1 uppercase & 1 number");
      return;
    }

    if (!accepted) {
      setError("Please accept Terms & Conditions");
      return;
    }

    try {
      let res;

      if (isLogin) {
        const userData = { email, password };
        res = await api.post("/auth/login", userData);
      } else {
        const userData = { name, email, password };
        res = await api.post("/auth/register", userData);
      }

      const serverUserData = res.data;

      // Save user details to storage
      localStorage.setItem("user", JSON.stringify(serverUserData.data.user));

      // FIXED: Pass the token to loginSync to alert your context provider globally
      loginSync(serverUserData.data.accessToken);

      setUser(serverUserData);
      setCurLog(true);

      // Close modal window ONLY upon verified server action success
      onClose();
    } catch (err) {
      const fallbackError = "Something went wrong. Please try again.";
      setError(err.response?.data?.message || err.message || fallbackError);
    }

    // FIXED: Removed the floating unconditional onClose() call that was down here!
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur z-40"
        onClick={onClose}
      ></div>

      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="relative w-[300px] p-6 bg-white/10 backdrop-blur rounded-xl shadow-lg text-white">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-white text-lg"
          >
            ✖
          </button>

          <div className="flex justify-between mb-4">
            <button
              onClick={() => setIsLogin(true)}
              className={`w-1/2 py-2 ${isLogin ? "bg-purple-500" : ""}`}
            >
              Login
            </button>

            <button
              onClick={() => setIsLogin(false)}
              className={`w-1/2 py-2 ${!isLogin ? "bg-purple-500" : ""}`}
            >
              Sign Up
            </button>
          </div>

          <h2 className="text-xl mb-4 text-center">
            {isLogin ? "Welcome Back 👋" : "Create Account ✨"}
          </h2>

          {!isLogin && (
            <input
              type="text"
              placeholder="Enter name"
              className="w-full mb-3 p-2 text-black rounded"
              onChange={(e) => setName(e.target.value)}
            />
          )}

          <input
            type="email"
            placeholder="Enter email"
            className="w-full mb-3 p-2 text-black rounded"
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="Enter password"
            className="w-full mb-2 p-2 text-black rounded"
            onChange={(e) => setPassword(e.target.value)}
          />

          <p className="text-xs text-gray-300 mb-3">
            Must include 6+ chars, 1 uppercase, 1 number
          </p>

          <div className="flex items-center gap-2 mb-3">
            <input
              type="checkbox"
              checked={accepted}
              onChange={() => setAccepted(!accepted)}
            />
            <p className="text-xs">I agree to Terms & Conditions</p>
          </div>

          {error && <p className="text-red-400 text-xs mb-2">{error}</p>}

          <button
            onClick={handleSubmit}
            className={`w-full py-2 rounded transition ${
              accepted
                ? "bg-purple-500 hover:bg-purple-600"
                : "bg-gray-500 cursor-not-allowed"
            }`}
          >
            {isLogin ? "Login" : "Sign Up"}
          </button>
        </div>
      </div>
    </>
  );
}
