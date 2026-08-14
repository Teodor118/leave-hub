import { createContext, useContext, useEffect, useState } from "react";
import { http, formatApiErr } from "@/lib/api";

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem("token");
    if (!t) {
      setLoading(false);
      return;
    }
    http
      .get("/auth/me")
      .then((r) => setUser(r.data))
      .catch(() => localStorage.removeItem("token"))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const { data } = await http.post("/auth/login", { email, password });
    localStorage.setItem("token", data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  return <Ctx.Provider value={{ user, loading, login, logout, formatApiErr }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
