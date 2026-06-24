'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { CheckSquare, Building2, Loader2, ArrowRight, Plus, X, AlertCircle } from 'lucide-react';

export default function SelectOrgPage() {
    const router = useRouter();
    const { user, orgs, loading, switchOrg } = useAuth();
    const [switching, setSwitching] = useState<string | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [orgName, setOrgName] = useState('');
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
                <Loader2 size={32} className="animate-spin text-teal-500" />
            </div>
        );
    }

    if (!user) {
        router.push('/login');
        return null;
    }

    const handleSelect = async (orgId: string) => {
        setSwitching(orgId);
        const result = await switchOrg(orgId);
        if (!result.error) {
            router.push('/dashboard');
        }
        setSwitching(null);
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!orgName.trim()) return;
        setCreating(true);
        setError('');

        try {
            const res = await fetch('/api/organizations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: orgName.trim(), user_limit: 10, licensing: 'Starter' }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to create organization');

            // Join org as admin and switch to it
            const joinRes = await fetch('/api/auth/join-org', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ organizationId: data.organizationId }),
            });
            const joinData = await joinRes.json();
            if (!joinRes.ok) throw new Error(joinData.error || 'Failed to join org');

            await switchOrg(data.organizationId);
            router.push('/dashboard');
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
            <div className="w-full max-w-lg">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-500 shadow-glow-teal mb-4">
                        <CheckSquare size={28} className="text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome, {user.name}</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Select an organization to continue
                    </p>
                </div>

                {/* Org List */}
                <div className="card p-6">
                    {orgs.length > 0 ? (
                        <div className="space-y-3">
                            {orgs.map((org) => (
                                <button
                                    key={org.id}
                                    onClick={() => handleSelect(org.id)}
                                    disabled={switching === org.id}
                                    className="w-full flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800 hover:bg-teal-50 dark:hover:bg-teal-500/10 border border-gray-200 dark:border-gray-700 hover:border-teal-300 dark:hover:border-teal-600 transition-all group"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-teal-500/20 flex items-center justify-center flex-shrink-0">
                                        <Building2 size={18} className="text-teal-600 dark:text-teal-400" />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <p className="font-semibold text-gray-900 dark:text-white text-sm">{org.name}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">{org.role}</span>
                                            <span className="text-gray-300 dark:text-gray-600">·</span>
                                            <span className="text-xs text-gray-500 dark:text-gray-400">{org.licensing}</span>
                                        </div>
                                    </div>
                                    <div className="text-gray-400 group-hover:text-teal-500 transition-colors">
                                        {switching === org.id ? (
                                            <Loader2 size={18} className="animate-spin" />
                                        ) : (
                                            <ArrowRight size={18} />
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-6">
                            <Building2 size={40} className="mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                            <p className="text-gray-500 dark:text-gray-400 text-sm">
                                You don't have any organizations yet.
                            </p>
                            <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
                                Create one to get started.
                            </p>
                        </div>
                    )}

                    <div className="mt-4">
                        <button
                            onClick={() => setShowCreate(true)}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-500 dark:text-gray-400 hover:border-teal-400 hover:text-teal-500 transition-all"
                        >
                            <Plus size={16} />
                            Create New Organization
                        </button>
                    </div>
                </div>
            </div>

            {/* Create Org Modal */}
            {showCreate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 glass" onClick={() => setShowCreate(false)} />
                    <div className="relative card w-full max-w-md p-6 animate-scale-in">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">New Organization</h2>
                            <button onClick={() => setShowCreate(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all">
                                <X size={16} />
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Organization Name *</label>
                                <input
                                    required
                                    className="input"
                                    placeholder="e.g. City Hospital"
                                    value={orgName}
                                    onChange={(e) => setOrgName(e.target.value)}
                                />
                            </div>
                            {error && (
                                <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-500/10 rounded-xl text-red-700 dark:text-red-400 text-sm">
                                    <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                                    <span>{error}</span>
                                </div>
                            )}
                            <div className="flex gap-3 pt-1">
                                <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
                                <button type="submit" className="btn-primary flex-1 justify-center" disabled={creating}>
                                    {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                                    {creating ? 'Creating...' : 'Create & Enter'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
