import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor para adjuntar el JWT Token automáticamente en cada petición
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token"); // O la clave donde guardes tu token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor opcional para manejar errores globales de autenticación (401 / 403)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      console.warn("Sesión expirada o no autorizada.");
    }
    return Promise.reject(error);
  }
);

export default api;