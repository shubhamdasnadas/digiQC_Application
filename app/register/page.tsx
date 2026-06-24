'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { CheckSquare, Loader2, Eye, EyeOff, AlertCircle } from 'lucide-react';

export default function RegisterPage() {
    const router = useRouter();
    const { register } = useAuth();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const result = await register(name, email, password);
        setLoading(false);

        if (result.error) {
            setError(result.error);
            return;
        }

        router.push('/select-org');
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-500 shadow-glow-teal mb-4">
                        <CheckSquare size={28} className="text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Digi<span className="text-teal-500">QC</span>
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Create your account
                    </p>
                </div>

                {/* Register Form */}
                <div className="card p-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                Full Name
                            </label>
                            <input
                                type="text"
                                className="input"
                                placeholder="John Doe"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                autoFocus
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                Email
                            </label>
                            <input
                                type="email"
                                className="input"
                                placeholder="you@company.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    className="input pr-10"
                                    placeholder="Minimum 6 characters"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={6}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-500/10 rounded-xl text-red-700 dark:text-red-400 text-sm">
                                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                                <span>{error}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            className="btn-primary w-full justify-center py-2.5"
                            disabled={loading}
                        >
                            {loading ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : null}
                            {loading ? 'Creating account...' : 'Create Account'}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Already have an account?{' '}
                            <Link
                                href="/login"
                                className="text-teal-600 dark:text-teal-400 font-medium hover:underline"
                            >
                                Sign in
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
