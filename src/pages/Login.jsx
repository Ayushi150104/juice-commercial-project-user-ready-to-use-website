import { useState } from "react";

export default function Login({ isOpen, onClose, setUser }) {
  const [isLogin, setIsLogin] = useState(true);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [accepted, setAccepted] = useState(false); // ✅ NEW
  const [error, setError] = useState(""); // ✅ NEW

  if (!isOpen) return null;

  // 🔐 PASSWORD VALIDATION
  const isStrongPassword = (pass) => {
    return pass.length >= 6 && /[A-Z]/.test(pass) && /[0-9]/.test(pass);
  };

  const handleSubmit = () => {
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

    const userData = {
      name: name || "User",
      email,
    };

    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);

    onClose();
  };

  return (
    <>
      {/* OVERLAY */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur z-40"
        onClick={onClose}
      ></div>

      {/* POPUP */}
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="relative w-[300px] p-6 bg-white/10 backdrop-blur rounded-xl shadow-lg text-white">
          {/* CLOSE */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-white text-lg"
          >
            ✖
          </button>

          {/* TOGGLE */}
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

          {/* NAME */}
          {!isLogin && (
            <input
              type="text"
              placeholder="Enter name"
              className="w-full mb-3 p-2 text-black rounded"
              onChange={(e) => setName(e.target.value)}
            />
          )}

          {/* EMAIL */}
          <input
            type="email"
            placeholder="Enter email"
            className="w-full mb-3 p-2 text-black rounded"
            onChange={(e) => setEmail(e.target.value)}
          />

          {/* PASSWORD */}
          <input
            type="password"
            placeholder="Enter password"
            className="w-full mb-2 p-2 text-black rounded"
            onChange={(e) => setPassword(e.target.value)}
          />

          {/* 🔥 PASSWORD HINT */}
          <p className="text-xs text-gray-300 mb-3">
            Must include 6+ chars, 1 uppercase, 1 number
          </p>

          {/* ✅ TERMS */}
          <div className="flex items-center gap-2 mb-3">
            <input
              type="checkbox"
              checked={accepted}
              onChange={() => setAccepted(!accepted)}
            />
            <p className="text-xs">I agree to Terms & Conditions</p>
          </div>

          {/* ❌ ERROR */}
          {error && <p className="text-red-400 text-xs mb-2">{error}</p>}

          {/* SUBMIT */}
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
