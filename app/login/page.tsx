'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { CheckSquare, Loader2, Eye, EyeOff, AlertCircle, Mail, KeyRound, ShieldCheck, X, RefreshCw, CheckCircle2 } from 'lucide-react';

const OTP_LENGTH = 6;

type IdentifierType = 'email' | 'mobile' | null;

function detectIdentifierType(value: string): IdentifierType {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.includes('@')) return 'email';
    const digitsOnly = trimmed.replace(/[\s\-()]/g, '').replace(/^\+/, '');
    if (/^\d{7,15}$/.test(digitsOnly)) return 'mobile';
    return null;
}

export default function LoginPage() {
    const router = useRouter();
    const { login, verifyOtp, resendOtp } = useAuth();

    // Login form state
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // OTP Modal state
    const [showOtpModal, setShowOtpModal] = useState(false);
    const [targetEmail, setTargetEmail] = useState('');
    const [otpDigits, setOtpDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
    const [otpLoading, setOtpLoading] = useState(false);
    const [otpError, setOtpError] = useState('');
    const [otpSuccess, setOtpSuccess] = useState('');
    const [resendCooldown, setResendCooldown] = useState(0);
    const [resending, setResending] = useState(false);

    const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

    const identifierType = detectIdentifierType(identifier);

    // Cooldown countdown effect
    useEffect(() => {
        if (resendCooldown > 0) {
            const timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [resendCooldown]);

    // Handle Login Submit (Step 1: Check credentials & trigger OTP send)
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!identifierType) {
            setError('Enter a valid email address or mobile number');
            return;
        }

        if (identifierType === 'mobile') {
            router.push(`/login/verify-otp?channel=mobile&value=${encodeURIComponent(identifier)}`);
            return;
        }

        setLoading(true);
        const result = await login(identifier, password);
        setLoading(false);

        if (result.error) {
            setError(result.error);
            return;
        }

        if (result.requireOtp) {
            setTargetEmail(result.email || identifier);
            setOtpDigits(Array(OTP_LENGTH).fill(''));
            setOtpError('');
            setOtpSuccess(`Verification code sent to ${result.email || identifier}`);
            setShowOtpModal(true);
            setResendCooldown(30);
            setTimeout(() => {
                otpInputRefs.current[0]?.focus();
            }, 100);
            return;
        }

        // Direct login fallback: directly load dashboard (bypass select-org)
        router.push('/dashboard');
    };

    // OTP Digit Inputs handler
    const handleOtpChange = (index: number, value: string) => {
        // Handle pasted string
        const cleaned = value.replace(/\D/g, '');
        if (cleaned.length > 1) {
            const pastedDigits = cleaned.slice(0, OTP_LENGTH).split('');
            const next = [...otpDigits];
            pastedDigits.forEach((d, i) => {
                if (index + i < OTP_LENGTH) {
                    next[index + i] = d;
                }
            });
            setOtpDigits(next);
            const focusIndex = Math.min(index + pastedDigits.length, OTP_LENGTH - 1);
            otpInputRefs.current[focusIndex]?.focus();

            // Auto-submit if all digits filled
            if (next.every((d) => d !== '')) {
                performOtpVerification(next.join(''));
            }
            return;
        }

        const digit = cleaned.slice(-1);
        const next = [...otpDigits];
        next[index] = digit;
        setOtpDigits(next);

        if (digit && index < OTP_LENGTH - 1) {
            otpInputRefs.current[index + 1]?.focus();
        }

        // If completed all digits
        if (digit && index === OTP_LENGTH - 1 && next.every((d) => d !== '')) {
            performOtpVerification(next.join(''));
        }
    };

    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
            otpInputRefs.current[index - 1]?.focus();
        }
    };

    // Perform OTP Verification (Step 2: Verify & Navigate directly to Dashboard)
    const performOtpVerification = async (codeToVerify?: string) => {
        const code = codeToVerify || otpDigits.join('');
        if (code.length !== OTP_LENGTH) {
            setOtpError('Please enter all 6 digits');
            return;
        }

        setOtpLoading(true);
        setOtpError('');
        const res = await verifyOtp(targetEmail, code);
        setOtpLoading(false);

        if (res.error) {
            setOtpError(res.error);
            return;
        }

        // Successfully verified: bypass select-org and load dashboard directly
        setShowOtpModal(false);
        router.replace('/dashboard');
        router.refresh();
    };

    const handleOtpSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        performOtpVerification();
    };

    // Resend OTP handler
    const handleResendOtp = async () => {
        if (resendCooldown > 0 || resending) return;
        setResending(true);
        setOtpError('');
        const res = await resendOtp(targetEmail);
        setResending(false);

        if (res.error) {
            setOtpError(res.error);
            return;
        }

        setOtpSuccess('A new 6-digit code has been sent to your email.');
        setResendCooldown(30);
        setOtpDigits(Array(OTP_LENGTH).fill(''));
        otpInputRefs.current[0]?.focus();
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
                        Sign in to your account
                    </p>
                </div>

                {/* Login Form */}
                <div className="card p-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                Email or Mobile Number
                            </label>
                            <input
                                type="text"
                                className="input"
                                placeholder="you@company.com or +91 98765 43210"
                                value={identifier}
                                onChange={(e) => setIdentifier(e.target.value)}
                                required
                                autoFocus
                            />
                        </div>

                        {identifierType === 'email' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                    Password
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        className="input pr-10"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
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

                        {identifierType === 'mobile' && (
                            <p className="text-xs text-gray-400 dark:text-gray-500">
                                We&apos;ll send a one-time password to sign you in.
                            </p>
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
                            {loading ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : null}
                            {loading
                                ? 'Sending verification code...'
                                : identifierType === 'mobile'
                                    ? 'Send OTP'
                                    : 'Sign In'}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Don&apos;t have an account?{' '}
                            <Link
                                href="/register"
                                className="text-teal-600 dark:text-teal-400 font-medium hover:underline"
                            >
                                Create one
                            </Link>
                        </p>
                    </div>
                </div>
            </div>

            {/* OTP Verification Popup Modal */}
            {showOtpModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
                        onClick={() => setShowOtpModal(false)}
                    />

                    {/* Modal Content */}
                    <div className="relative card w-full max-w-md p-6 shadow-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-2xl animate-scale-in z-10">
                        {/* Close button */}
                        <button
                            onClick={() => setShowOtpModal(false)}
                            className="absolute right-4 top-4 w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                            <X size={18} />
                        </button>

                        <div className="text-center mb-6">
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 mb-3">
                                <ShieldCheck size={26} />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                Two-Step Verification
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                Enter the 6-digit verification code sent to
                            </p>
                            <p className="text-sm font-semibold text-teal-600 dark:text-teal-400">
                                {targetEmail}
                            </p>
                        </div>

                        {otpSuccess && (
                            <div className="flex items-center gap-2 p-3 mb-4 bg-teal-50 dark:bg-teal-500/10 rounded-xl text-teal-700 dark:text-teal-400 text-xs">
                                <CheckCircle2 size={16} className="flex-shrink-0" />
                                <span>{otpSuccess}</span>
                            </div>
                        )}

                        {otpError && (
                            <div className="flex items-start gap-2 p-3 mb-4 bg-red-50 dark:bg-red-500/10 rounded-xl text-red-700 dark:text-red-400 text-xs">
                                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                                <span>{otpError}</span>
                            </div>
                        )}

                        <form onSubmit={handleOtpSubmit} className="space-y-6">
                            {/* 6-Digit OTP inputs */}
                            <div className="flex items-center justify-center gap-2 sm:gap-3">
                                {otpDigits.map((digit, i) => (
                                    <input
                                        key={i}
                                        ref={(el) => {
                                            otpInputRefs.current[i] = el;
                                        }}
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        maxLength={1}
                                        className="w-11 h-13 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-bold bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:border-teal-500 dark:focus:border-teal-400 focus:outline-none focus:ring-4 focus:ring-teal-500/20 text-gray-900 dark:text-white transition-all shadow-sm"
                                        value={digit}
                                        onChange={(e) => handleOtpChange(i, e.target.value)}
                                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                                        autoComplete="one-time-code"
                                    />
                                ))}
                            </div>

                            <button
                                type="submit"
                                className="btn-primary w-full justify-center py-3 text-sm font-semibold shadow-glow-teal"
                                disabled={otpLoading || otpDigits.some((d) => d === '')}
                            >
                                {otpLoading ? (
                                    <Loader2 size={18} className="animate-spin mr-2" />
                                ) : null}
                                {otpLoading ? 'Verifying & Signing in...' : 'Verify & Enter Dashboard'}
                            </button>

                            {/* Resend OTP */}
                            <div className="flex items-center justify-between text-xs pt-1 text-gray-500 dark:text-gray-400">
                                <span>Didn&apos;t receive the code?</span>
                                {resendCooldown > 0 ? (
                                    <span className="text-gray-400 font-medium">
                                        Resend in {resendCooldown}s
                                    </span>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleResendOtp}
                                        disabled={resending}
                                        className="inline-flex items-center gap-1 text-teal-600 dark:text-teal-400 font-semibold hover:underline"
                                    >
                                        {resending ? (
                                            <RefreshCw size={12} className="animate-spin" />
                                        ) : null}
                                        Resend Code
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
