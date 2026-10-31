import { createContext, useContext, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  });

  function login(userData, token) {
    // Normalizamos el rol para condicionales
    const normalizedUser = {
      ...userData,
      rol: (userData.role || userData.rol || "").toLowerCase(),
    };

    // Guardar tanto el usuario como el token recibido
    localStorage.setItem("user", JSON.stringify(normalizedUser));
    
    // Si la respuesta del backend incluye el token en userData.token o se pasa como argumento
    const jwtToken = token || userData.token || userData.accessToken;
    if (jwtToken) {
      localStorage.setItem("token", jwtToken);
    }

    setUser(normalizedUser);
  }

  function logout() {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}