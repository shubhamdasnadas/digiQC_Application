'use client';

import { Suspense, useRef, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { CheckSquare, ArrowLeft, Smartphone, Mail, Loader2, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';

const OTP_LENGTH = 6;

function VerifyOtpForm() {
    const router = useRouter();
    const params = useSearchParams();
    const { verifyOtp, resendOtp } = useAuth();

    const channel = params.get('channel') === 'mobile' ? 'mobile' : 'email';
    const value = params.get('value') || '';

    const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(30);
    const [resending, setResending] = useState(false);

    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
        if (resendCooldown > 0) {
            const timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [resendCooldown]);

    const handleChange = (index: number, raw: string) => {
        const cleaned = raw.replace(/\D/g, '');
        if (cleaned.length > 1) {
            const pastedDigits = cleaned.slice(0, OTP_LENGTH).split('');
            const next = [...digits];
            pastedDigits.forEach((d, i) => {
                if (index + i < OTP_LENGTH) {
                    next[index + i] = d;
                }
            });
            setDigits(next);
            const focusIndex = Math.min(index + pastedDigits.length, OTP_LENGTH - 1);
            inputRefs.current[focusIndex]?.focus();

            if (next.every((d) => d !== '')) {
                handleVerifyDirect(next.join(''));
            }
            return;
        }

        const digit = cleaned.slice(-1);
        const next = [...digits];
        next[index] = digit;
        setDigits(next);

        if (digit && index < OTP_LENGTH - 1) {
            inputRefs.current[index + 1]?.focus();
        }

        if (digit && index === OTP_LENGTH - 1 && next.every((d) => d !== '')) {
            handleVerifyDirect(next.join(''));
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !digits[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleVerifyDirect = async (codeToVerify: string) => {
        if (codeToVerify.length !== OTP_LENGTH) return;
        setLoading(true);
        setError('');
        const res = await verifyOtp(value, codeToVerify);
        setLoading(false);

        if (res.error) {
            setError(res.error);
            return;
        }

        // Directly load dashboard
        router.replace('/dashboard');
        router.refresh();
    };

    const handleVerify = (e: React.FormEvent) => {
        e.preventDefault();
        handleVerifyDirect(digits.join(''));
    };

    const handleResend = async () => {
        if (resendCooldown > 0 || resending || !value) return;
        setResending(true);
        setError('');
        const res = await resendOtp(value);
        setResending(false);

        if (res.error) {
            setError(res.error);
            return;
        }

        setSuccess('A new verification code has been sent.');
        setResendCooldown(30);
        setDigits(Array(OTP_LENGTH).fill(''));
        inputRefs.current[0]?.focus();
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-500 shadow-glow-teal mb-4">
                        <CheckSquare size={28} className="text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Valid<span className="text-teal-500">8</span>
                    </h1>
                </div>

                <div className="card p-6">
                    <div className="flex items-center gap-2 mb-1.5 text-teal-600 dark:text-teal-400">
                        {channel === 'mobile' ? <Smartphone size={16} /> : <Mail size={16} />}
                        <span className="text-xs font-medium uppercase tracking-wide">
                            {channel === 'mobile' ? 'Mobile verification' : 'Email verification'}
                        </span>
                    </div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                        Enter verification code
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                        {value ? (
                            <>We sent a 6-digit code to <span className="font-medium text-gray-700 dark:text-gray-300">{value}</span>.</>
                        ) : (
                            'We sent a 6-digit code to continue.'
                        )}
                    </p>

                    {success && (
                        <div className="flex items-center gap-2 p-3 mb-4 bg-teal-50 dark:bg-teal-500/10 rounded-xl text-teal-700 dark:text-teal-400 text-xs">
                            <CheckCircle2 size={16} className="flex-shrink-0" />
                            <span>{success}</span>
                        </div>
                    )}

                    {error && (
                        <div className="flex items-start gap-2 p-3 mb-4 bg-red-50 dark:bg-red-500/10 rounded-xl text-red-700 dark:text-red-400 text-xs">
                            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleVerify} className="space-y-5">
                        <div className="flex items-center justify-between gap-2">
                            {digits.map((digit, i) => (
                                <input
                                    key={i}
                                    ref={(el) => { inputRefs.current[i] = el; }}
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={1}
                                    className="input text-center text-lg font-semibold w-11 h-12 px-0"
                                    value={digit}
                                    onChange={(e) => handleChange(i, e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(i, e)}
                                    autoFocus={i === 0}
                                />
                            ))}
                        </div>

                        <button
                            type="submit"
                            className="btn-primary w-full justify-center py-2.5"
                            disabled={loading || digits.some((d) => d === '')}
                        >
                            {loading ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                            {loading ? 'Verifying...' : 'Verify & Enter Dashboard'}
                        </button>

                        <div className="text-center pt-1">
                            {resendCooldown > 0 ? (
                                <span className="text-xs text-gray-400">Resend code in {resendCooldown}s</span>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleResend}
                                    disabled={resending}
                                    className="inline-flex items-center gap-1 text-sm text-teal-600 dark:text-teal-400 font-medium hover:underline"
                                >
                                    {resending ? <RefreshCw size={14} className="animate-spin" /> : null}
                                    Resend code
                                </button>
                            )}
                        </div>
                    </form>

                    <div className="mt-6 text-center">
                        <button
                            onClick={() => router.push('/login')}
                            className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                        >
                            <ArrowLeft size={14} /> Back to sign in
                        </button>
                    </div>

                    <div className="mt-4 text-center">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Don&apos;t have an account?{' '}
                            <Link href="/register" className="text-teal-600 dark:text-teal-400 font-medium hover:underline">
                                Create one
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function VerifyOtpPage() {
    return (
        <Suspense fallback={null}>
            <VerifyOtpForm />
        </Suspense>
    );
}
