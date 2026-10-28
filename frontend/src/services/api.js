import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:4000/api",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor de Solicitudes HTTP
api.interceptors.request.use(
  (config) => {
    // Intenta leer el token desde localStorage bajo cualquier clave posible
    const token =
      localStorage.getItem("token") ||
      localStorage.getItem("authToken") ||
      localStorage.getItem("token_acceso") ||
      localStorage.getItem("jwt");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      config.headers["authorization"] = `Bearer ${token}`;
      config.headers["x-access-token"] = token;
    } else {
      console.warn("Sin token guardado en localStorage");
    }

    // Si es un envío Multipart (Excel), permite que Axios ponga el boundary automático
    if (config.data instanceof FormData) {
      delete config.headers["Content-Type"];
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor de Respuestas
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      console.warn("Sesión expirada o no autorizada:", error.response.data);
    }
    return Promise.reject(error);
  }
);

export { api };
export default api;