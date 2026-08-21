import { createContext, useContext, useEffect, useMemo, useState } from 'react';
/* eslint-disable react-refresh/only-export-components */
import { api, json } from '../../services/api.js';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api('/auth/me')
      .then(({ user: value }) => setUser(value))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);
  const value = useMemo(
    () => ({
      user,
      loading,
      async login(credentials) {
        const data = await api('/auth/login', { method: 'POST', body: json(credentials) });
        setUser(data.user);
      },
      async logout() {
        await api('/auth/logout', { method: 'POST' });
        setUser(null);
      },
    }),
    [user, loading],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
