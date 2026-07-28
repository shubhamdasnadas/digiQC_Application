'use client';

import { Suspense, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckSquare, ArrowLeft, Smartphone, Mail } from 'lucide-react';

const OTP_LENGTH = 6;

function VerifyOtpForm() {
    const router = useRouter();
    const params = useSearchParams();
    const channel = params.get('channel') === 'mobile' ? 'mobile' : 'email';
    const value = params.get('value') || '';

    const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
    const [note, setNote] = useState('');
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    const handleChange = (index: number, raw: string) => {
        const digit = raw.replace(/\D/g, '').slice(-1);
        setDigits((prev) => {
            const next = [...prev];
            next[index] = digit;
            return next;
        });
        if (digit && index < OTP_LENGTH - 1) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !digits[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const code = digits.join('');

    const handleVerify = (e: React.FormEvent) => {
        e.preventDefault();
        setNote('This is a placeholder screen — OTP delivery/verification isn\'t wired up yet.');
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-500 shadow-glow-teal mb-4">
                        <CheckSquare size={28} className="text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Digi<span className="text-teal-500">QC</span>
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

                        {note && (
                            <div className="p-3 bg-teal-50 dark:bg-teal-900/20 rounded-xl text-teal-700 dark:text-teal-400 text-sm">
                                {note}
                            </div>
                        )}

                        <button
                            type="submit"
                            className="btn-primary w-full justify-center py-2.5"
                            disabled={code.length !== OTP_LENGTH}
                        >
                            Verify &amp; Continue
                        </button>

                        <button
                            type="button"
                            onClick={() => setNote('Demo mode — no OTP was actually sent, so there\'s nothing to resend yet.')}
                            className="w-full text-center text-sm text-teal-600 dark:text-teal-400 font-medium hover:underline"
                        >
                            Resend code
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <button
                            onClick={() => router.push('/register')}
                            className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                        >
                            <ArrowLeft size={14} /> Back to sign up
                        </button>
                    </div>

                    <div className="mt-4 text-center">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Already have an account?{' '}
                            <Link href="/login" className="text-teal-600 dark:text-teal-400 font-medium hover:underline">
                                Sign in
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
