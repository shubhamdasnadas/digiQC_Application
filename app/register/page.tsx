'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { CheckSquare, Loader2, Eye, EyeOff, AlertCircle, Mail, Smartphone, KeyRound, MessageSquareText } from 'lucide-react';

type SignupChannel = 'email' | 'mobile';
type EmailMethod = 'password' | 'otp';

export default function RegisterPage() {
    const router = useRouter();
    const { register } = useAuth();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [mobile, setMobile] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [channel, setChannel] = useState<SignupChannel>('email');
    const [emailMethod, setEmailMethod] = useState<EmailMethod>('password');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (channel === 'mobile') {
            router.push(`/register/verify-otp?channel=mobile&value=${encodeURIComponent(mobile)}`);
            return;
        }

        if (emailMethod === 'otp') {
            router.push(`/register/verify-otp?channel=email&value=${encodeURIComponent(email)}`);
            return;
        }

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
                        Valid<span className="text-teal-500">8</span>
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Create your account
                    </p>
                </div>

                {/* Register Form */}
                <div className="card p-6">
                    {/* Channel toggle: Email vs Mobile */}
                    <div className="grid grid-cols-2 gap-1 p-1 mb-5 rounded-xl bg-gray-100 dark:bg-gray-800">
                        <button
                            type="button"
                            onClick={() => setChannel('email')}
                            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                                channel === 'email'
                                    ? 'bg-white dark:bg-gray-950 text-teal-600 dark:text-teal-400 shadow-sm'
                                    : 'text-gray-500 dark:text-gray-400'
                            }`}
                        >
                            <Mail size={14} /> Email
                        </button>
                        <button
                            type="button"
                            onClick={() => setChannel('mobile')}
                            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                                channel === 'mobile'
                                    ? 'bg-white dark:bg-gray-950 text-teal-600 dark:text-teal-400 shadow-sm'
                                    : 'text-gray-500 dark:text-gray-400'
                            }`}
                        >
                            <Smartphone size={14} /> Mobile
                        </button>
                    </div>

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

                        {channel === 'email' ? (
                            <>
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

                                {/* Email method toggle: Password vs OTP */}
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setEmailMethod('password')}
                                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border transition-colors ${
                                            emailMethod === 'password'
                                                ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400'
                                                : 'border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400'
                                        }`}
                                    >
                                        <KeyRound size={13} /> Use Password
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setEmailMethod('otp')}
                                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border transition-colors ${
                                            emailMethod === 'otp'
                                                ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400'
                                                : 'border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400'
                                        }`}
                                    >
                                        <MessageSquareText size={13} /> Use OTP
                                    </button>
                                </div>

                                {emailMethod === 'password' && (
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
                                )}
                            </>
                        ) : (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                    Mobile Number
                                </label>
                                <input
                                    type="tel"
                                    className="input"
                                    placeholder="+91 98765 43210"
                                    value={mobile}
                                    onChange={(e) => setMobile(e.target.value)}
                                    required
                                />
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
                                    We&apos;ll send a one-time password to verify this number.
                                </p>
                            </div>
                        )}

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
                            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                            {loading
                                ? 'Creating account...'
                                : channel === 'mobile' || emailMethod === 'otp'
                                    ? 'Send OTP'
                                    : 'Create Account'}
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
