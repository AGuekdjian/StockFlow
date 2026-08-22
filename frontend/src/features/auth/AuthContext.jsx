import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
/* eslint-disable react-refresh/only-export-components */
import { api, json } from '../../services/api.js';
import { preloadRoute } from '../../routes/pageLoaders.js';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    preloadRoute(window.location.pathname);
    api('/auth/me')
      .then(({ user: value }) => setUser(value))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);
  const login = useCallback(async (credentials) => {
    const data = await api('/auth/login', { method: 'POST', body: json(credentials) });
    setUser(data.user);
  }, []);
  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' });
    setUser(null);
  }, []);
  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
