import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, CurrentOrg } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  orgs: CurrentOrg[];
  currentOrg: CurrentOrg | null;
  isLoading: boolean;
  login: (email: string, password_hash: string) => Promise<void>;
  register: (name: string, email: string, password_hash: string) => Promise<void>;
  switchOrg: (orgId: string) => Promise<void>;
  joinOrg: (orgId: string, role?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [orgs, setOrgs] = useState<CurrentOrg[]>([]);
  const [currentOrg, setCurrentOrg] = useState<CurrentOrg | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const bootstrapSession = async (retries = 2) => {
    try {
      setIsLoading(true);
      const data = await api.getMe();
      if (data) {
        setUser(data.user);
        setOrgs(data.orgs || []);
        setCurrentOrg(data.currentOrg || (data.orgs && data.orgs[0]) || null);
        if (data.user?.id) localStorage.setItem('digiqc_user_id', data.user.id);
        if (data.currentOrg?.id) localStorage.setItem('digiqc_org_id', data.currentOrg.id);
      } else if (retries > 0) {
        await new Promise(r => setTimeout(r, 400));
        return bootstrapSession(retries - 1);
      }
    } catch (err) {
      if (retries > 0) {
        await new Promise(r => setTimeout(r, 400));
        return bootstrapSession(retries - 1);
      }
      console.warn('Session bootstrap completed without active session:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    bootstrapSession();
  }, []);

  const login = async (email: string, password_hash: string) => {
    const data = await api.login(email, password_hash);
    setUser(data.user);
    setOrgs(data.orgs || []);
    const activeOrg = data.currentOrg || (data.orgs && data.orgs[0]) || null;
    setCurrentOrg(activeOrg);
    if (data.user?.id) localStorage.setItem('digiqc_user_id', data.user.id);
    if (activeOrg?.id) localStorage.setItem('digiqc_org_id', activeOrg.id);
  };

  const register = async (name: string, email: string, password_hash: string) => {
    const data = await api.register(name, email, password_hash);
    setUser(data.user);
    setOrgs(data.orgs || []);
    const activeOrg = data.currentOrg || (data.orgs && data.orgs[0]) || null;
    setCurrentOrg(activeOrg);
    if (data.user?.id) localStorage.setItem('digiqc_user_id', data.user.id);
    if (activeOrg?.id) localStorage.setItem('digiqc_org_id', activeOrg.id);
  };

  const switchOrg = async (orgId: string) => {
    const data = await api.switchOrg(orgId);
    setUser(data.user);
    setOrgs(data.orgs);
    setCurrentOrg(data.currentOrg);
    localStorage.setItem('digiqc_org_id', orgId);
    window.location.reload(); // Refresh data context for new tenant
  };

  const joinOrg = async (orgId: string, role = 'admin') => {
    const data = await api.joinOrg(orgId, role);
    setUser(data.user);
    setOrgs(data.orgs);
    setCurrentOrg(data.currentOrg);
    if (data.currentOrg?.id) localStorage.setItem('digiqc_org_id', data.currentOrg.id);
  };

  const logout = () => {
    setUser(null);
    setCurrentOrg(null);
    setOrgs([]);
    localStorage.removeItem('digiqc_user_id');
    localStorage.removeItem('digiqc_org_id');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        orgs,
        currentOrg,
        isLoading,
        login,
        register,
        switchOrg,
        joinOrg,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
