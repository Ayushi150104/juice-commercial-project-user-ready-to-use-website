import axios from "axios";

const api = axios.create({
  baseURL: "https://juice-commercial-project-user-ready-to.onrender.com/",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

export default api;
