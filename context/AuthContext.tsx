'use client';

import { createContext, useContext, useEffect, useState, type ReactNode, useCallback } from 'react';
import type { User, OrgWithRole } from '@/lib/types';

interface AuthState {
    user: User | null;
    orgs: OrgWithRole[];
    currentOrg: OrgWithRole | null;
    loading: boolean;
}

interface AuthContextValue extends AuthState {
    login: (email: string, password: string) => Promise<{ error?: string }>;
    register: (name: string, email: string, password: string) => Promise<{ error?: string }>;
    logout: () => Promise<void>;
    switchOrg: (orgId: string) => Promise<{ error?: string }>;
    refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<AuthState>({
        user: null,
        orgs: [],
        currentOrg: null,
        loading: true,
    });

    const fetchMe = useCallback(async () => {
        try {
            const res = await fetch('/api/auth/me');
            if (!res.ok) throw new Error('Not authenticated');
            const data = await res.json();
            setState({
                user: data.user,
                orgs: data.orgs ?? [],
                currentOrg: data.currentOrg ?? null,
                loading: false,
            });
        } catch {
            setState({ user: null, orgs: [], currentOrg: null, loading: false });
        }
    }, []);

    useEffect(() => { fetchMe(); }, [fetchMe]);

    const login = async (email: string, password: string) => {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) return { error: data.error || 'Login failed' };
        await fetchMe();
        return {};
    };

    const register = async (name: string, email: string, password: string) => {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password }),
        });
        const data = await res.json();
        if (!res.ok) return { error: data.error || 'Registration failed' };
        await fetchMe();
        return {};
    };

    const logout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        setState({ user: null, orgs: [], currentOrg: null, loading: false });
    };

    const switchOrg = async (orgId: string) => {
        const res = await fetch('/api/auth/switch-org', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orgId }),
        });
        const data = await res.json();
        if (!res.ok) return { error: data.error || 'Failed to switch org' };
        await fetchMe();
        return {};
    };

    const refresh = fetchMe;

    return (
        <AuthContext.Provider value={{ ...state, login, register, logout, switchOrg, refresh }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
    return ctx;
}
