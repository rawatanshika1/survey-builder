import axios from "axios";
import toast from "react-hot-toast";

// In local dev, requests to "/api" are proxied to localhost:5000 (see
// vite.config.js). In production, set VITE_API_URL to the deployed
// backend's URL (e.g. https://survey-builder-kg6e.onrender.com/api)
// as an environment variable on Vercel.
const baseURL = import.meta.env.VITE_API_URL || "/api";

const api = axios.create({
  baseURL
});
// Attach JWT token automatically once auth is added (Prompt 2)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Global error handling: show a toast for unexpected failures.
// Individual pages can still catch specific errors (e.g. form validation
// messages) and show their own inline errors - this is just a safety net
// for anything that isn't handled locally, plus network/server outages.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      toast.error("Network error - is the server running?");
    } else if (error.response.status === 403) {
      toast.error("You don't have permission to do that");
    } else if (error.response.status >= 500) {
      toast.error("Something went wrong on the server. Please try again.");
    }
    return Promise.reject(error);
  }
);

export default api;
