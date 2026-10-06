'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import {
    CheckSquare,
    Loader2,
    Eye,
    EyeOff,
    AlertCircle,
    Mail,
    KeyRound,
    ShieldCheck,
    RefreshCw,
    CheckCircle2,
    ArrowLeft,
    ArrowRight,
    UserCheck,
} from 'lucide-react';

const OTP_LENGTH = 6;

type AuthMethod = 'password' | 'otp';

export default function LoginPage() {
    const router = useRouter();
    const { checkUser, login, sendOtp, verifyOtp, resendOtp } = useAuth();

    // Step state: 1 = Enter Email/Mobile, 2 = Authenticate (Password or OTP)
    const [step, setStep] = useState<1 | 2>(1);

    // Step 1: Identifier
    const [identifier, setIdentifier] = useState('');
    const [checkingUser, setCheckingUser] = useState(false);
    const [step1Error, setStep1Error] = useState('');

    // Verified User details
    const [verifiedEmail, setVerifiedEmail] = useState('');
    const [verifiedName, setVerifiedName] = useState('');
    const [hasPassword, setHasPassword] = useState(true);

    // Step 2: Authentication Method & Inputs
    const [authMethod, setAuthMethod] = useState<AuthMethod>('password');

    // Password State
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [passwordError, setPasswordError] = useState('');

    // OTP State
    const [otpDigits, setOtpDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
    const [otpSent, setOtpSent] = useState(false);
    const [otpSending, setOtpSending] = useState(false);
    const [otpVerifying, setOtpVerifying] = useState(false);
    const [otpError, setOtpError] = useState('');
    const [otpSuccess, setOtpSuccess] = useState('');
    const [resendCooldown, setResendCooldown] = useState(0);
    const [resending, setResending] = useState(false);

    const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

    // Cooldown timer for OTP resend
    useEffect(() => {
        if (resendCooldown > 0) {
            const timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [resendCooldown]);

    // Step 1: Check if email/user exists in database
    const handleCheckUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setStep1Error('');

        const trimmed = identifier.trim();
        if (!trimmed) {
            setStep1Error('Please enter your email or mobile number');
            return;
        }

        setCheckingUser(true);
        const res = await checkUser(trimmed);
        setCheckingUser(false);

        if (!res.exists || !res.email) {
            setStep1Error(res.error || 'No account found with this email or mobile number. Please check your credentials or create an account.');
            return;
        }

        // Email matched with database!
        setVerifiedEmail(res.email);
        setVerifiedName(res.name || '');
        setHasPassword(res.hasPassword ?? true);

        // If user has no password set yet, default to OTP tab
        if (res.hasPassword === false) {
            setAuthMethod('otp');
        } else {
            setAuthMethod('password');
        }

        setStep(2);
        setPassword('');
        setPasswordError('');
        setOtpError('');
        setOtpSuccess('');
        setOtpDigits(Array(OTP_LENGTH).fill(''));
    };

    // Go back to Step 1 to change email
    const handleBackToEmail = () => {
        setStep(1);
        setStep1Error('');
        setPasswordError('');
        setOtpError('');
        setOtpSuccess('');
        setPassword('');
        setOtpDigits(Array(OTP_LENGTH).fill(''));
    };

    // Step 2 - Option 1: Password Login
    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordError('');

        if (!password) {
            setPasswordError('Please enter your password');
            return;
        }

        setPasswordLoading(true);
        const res = await login(verifiedEmail, password);
        setPasswordLoading(false);

        if (res.error) {
            setPasswordError(res.error);
            return;
        }

        // Password matched database -> navigate directly to Dashboard!
        router.replace('/dashboard');
        router.refresh();
    };

    // Step 2 - Option 2: Send OTP
    const handleSendOtp = async () => {
        setOtpSending(true);
        setOtpError('');
        setOtpSuccess('');

        const res = await sendOtp(verifiedEmail);
        setOtpSending(false);

        if (res.error) {
            setOtpError(res.error);
            return;
        }

        setOtpSent(true);
        setOtpSuccess(`Verification code sent to ${verifiedEmail}`);
        setResendCooldown(30);
        setOtpDigits(Array(OTP_LENGTH).fill(''));

        setTimeout(() => {
            otpInputRefs.current[0]?.focus();
        }, 100);
    };

    // Step 2 - Option 2: OTP Digit Inputs
    const handleOtpChange = (index: number, value: string) => {
        // Handle pasted 6-digit code
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

        // Auto-verify when 6th digit entered
        if (digit && index === OTP_LENGTH - 1 && next.every((d) => d !== '')) {
            performOtpVerification(next.join(''));
        }
    };

    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
            otpInputRefs.current[index - 1]?.focus();
        }
    };

    // Step 2 - Option 2: Verify OTP and navigate directly to Dashboard
    const performOtpVerification = async (codeToVerify?: string) => {
        const code = codeToVerify || otpDigits.join('');
        if (code.length !== OTP_LENGTH) {
            setOtpError('Please enter all 6 digits');
            return;
        }

        setOtpVerifying(true);
        setOtpError('');
        const res = await verifyOtp(verifiedEmail, code);
        setOtpVerifying(false);

        if (res.error) {
            setOtpError(res.error);
            return;
        }

        // OTP verified successfully -> navigate directly to Dashboard!
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
        const res = await resendOtp(verifiedEmail);
        setResending(false);

        if (res.error) {
            setOtpError(res.error);
            return;
        }

        setOtpSuccess(`A fresh 6-digit code has been sent to ${verifiedEmail}`);
        setResendCooldown(30);
        setOtpDigits(Array(OTP_LENGTH).fill(''));
        otpInputRefs.current[0]?.focus();
    };

    // Switch method and auto-send OTP if needed
    const handleSwitchToOtp = () => {
        setAuthMethod('otp');
        setPasswordError('');
        if (!otpSent) {
            handleSendOtp();
        }
    };

    const handleSwitchToPassword = () => {
        setAuthMethod('password');
        setOtpError('');
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4 transition-colors">
            <div className="w-full max-w-md">
                {/* Logo & Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-500 shadow-glow-teal mb-4">
                        <CheckSquare size={28} className="text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                        Valid<span className="text-teal-500">8</span>
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Sign in to your account
                    </p>
                </div>

                {/* Main Auth Card */}
                <div className="card p-6 sm:p-8 shadow-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-2xl">
                    {/* STEP 1: Email / Mobile Input */}
                    {step === 1 && (
                        <form onSubmit={handleCheckUser} className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                    Email or Mobile Number
                                </label>
                                <input
                                    type="text"
                                    className="input text-base"
                                    placeholder="you@company.com or +91 98765 43210"
                                    value={identifier}
                                    onChange={(e) => setIdentifier(e.target.value)}
                                    required
                                    autoFocus
                                />
                            </div>

                            {step1Error && (
                                <div className="flex items-start gap-2.5 p-3.5 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-red-700 dark:text-red-400 text-sm">
                                    <AlertCircle size={17} className="flex-shrink-0 mt-0.5" />
                                    <span>{step1Error}</span>
                                </div>
                            )}

                            <button
                                type="submit"
                                className="btn-primary w-full justify-center py-3 text-base font-semibold shadow-glow-teal gap-2"
                                disabled={checkingUser || !identifier.trim()}
                            >
                                {checkingUser ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin" />
                                        <span>Checking account...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Continue</span>
                                        <ArrowRight size={17} />
                                    </>
                                )}
                            </button>

                            <div className="text-center pt-2">
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Don&apos;t have an account?{' '}
                                    <Link
                                        href="/register"
                                        className="text-teal-600 dark:text-teal-400 font-semibold hover:underline"
                                    >
                                        Create one
                                    </Link>
                                </p>
                            </div>
                        </form>
                    )}

                    {/* STEP 2: Email Matched -> Choose Password or OTP */}
                    {step === 2 && (
                        <div className="space-y-5">
                            {/* Verified User Pill / Header */}
                            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/70 border border-gray-200 dark:border-gray-700/60 rounded-xl">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center flex-shrink-0 font-bold text-xs uppercase">
                                        <UserCheck size={16} />
                                    </div>
                                    <div className="min-w-0">
                                        {verifiedName && (
                                            <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">
                                                {verifiedName}
                                            </p>
                                        )}
                                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                            {verifiedEmail}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleBackToEmail}
                                    className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 hover:underline px-2 py-1"
                                >
                                    Change
                                </button>
                            </div>

                            {/* Authentication Option Tabs */}
                            <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 dark:bg-gray-800/80 rounded-xl">
                                <button
                                    type="button"
                                    onClick={handleSwitchToPassword}
                                    className={`flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                                        authMethod === 'password'
                                            ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                                    }`}
                                >
                                    <KeyRound size={16} />
                                    <span>Password</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSwitchToOtp}
                                    className={`flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                                        authMethod === 'otp'
                                            ? 'bg-white dark:bg-gray-700 text-teal-600 dark:text-teal-400 shadow-sm'
                                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                                    }`}
                                >
                                    <ShieldCheck size={16} />
                                    <span>OTP Code</span>
                                </button>
                            </div>

                            {/* OPTION 1: PASSWORD AUTHENTICATION */}
                            {authMethod === 'password' && (
                                <form onSubmit={handlePasswordSubmit} className="space-y-4 pt-1">
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                                Password
                                            </label>
                                            <button
                                                type="button"
                                                onClick={handleSwitchToOtp}
                                                className="text-xs text-teal-600 dark:text-teal-400 hover:underline font-medium"
                                            >
                                                Sign in with OTP instead
                                            </button>
                                        </div>
                                        <div className="relative">
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                className="input pr-10 text-base"
                                                placeholder="••••••••"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                required
                                                autoFocus
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1"
                                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                                            >
                                                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                                            </button>
                                        </div>
                                    </div>

                                    {passwordError && (
                                        <div className="flex items-start gap-2.5 p-3.5 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-red-700 dark:text-red-400 text-sm">
                                            <AlertCircle size={17} className="flex-shrink-0 mt-0.5" />
                                            <span>{passwordError}</span>
                                        </div>
                                    )}

                                    <button
                                        type="submit"
                                        className="btn-primary w-full justify-center py-3 text-base font-semibold shadow-glow-teal"
                                        disabled={passwordLoading || !password}
                                    >
                                        {passwordLoading ? (
                                            <>
                                                <Loader2 size={18} className="animate-spin mr-2" />
                                                <span>Signing in...</span>
                                            </>
                                        ) : (
                                            'Sign In'
                                        )}
                                    </button>

                                    <div className="text-center pt-2">
                                        <button
                                            type="button"
                                            onClick={handleSwitchToOtp}
                                            className="inline-flex items-center gap-1.5 text-xs text-teal-600 dark:text-teal-400 hover:underline font-medium"
                                        >
                                            <Mail size={13} />
                                            <span>Forgot password? Sign in with OTP</span>
                                        </button>
                                    </div>
                                </form>
                            )}

                            {/* OPTION 2: OTP AUTHENTICATION */}
                            {authMethod === 'otp' && (
                                <div className="space-y-4 pt-1">
                                    {!otpSent ? (
                                        /* Prompt to send OTP */
                                        <div className="text-center py-2 space-y-4">
                                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 mb-1">
                                                <Mail size={24} />
                                            </div>
                                            <p className="text-sm text-gray-600 dark:text-gray-300">
                                                We will send a 6-digit one-time verification code to:
                                            </p>
                                            <p className="text-sm font-semibold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10 py-1.5 px-3 rounded-lg inline-block">
                                                {verifiedEmail}
                                            </p>

                                            {otpError && (
                                                <div className="flex items-start gap-2.5 p-3.5 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-red-700 dark:text-red-400 text-sm text-left">
                                                    <AlertCircle size={17} className="flex-shrink-0 mt-0.5" />
                                                    <span>{otpError}</span>
                                                </div>
                                            )}

                                            <button
                                                type="button"
                                                onClick={handleSendOtp}
                                                disabled={otpSending}
                                                className="btn-primary w-full justify-center py-3 text-base font-semibold shadow-glow-teal"
                                            >
                                                {otpSending ? (
                                                    <>
                                                        <Loader2 size={18} className="animate-spin mr-2" />
                                                        <span>Sending OTP...</span>
                                                    </>
                                                ) : (
                                                    'Send OTP to Email'
                                                )}
                                            </button>
                                        </div>
                                    ) : (
                                        /* 6-Digit OTP Form */
                                        <form onSubmit={handleOtpSubmit} className="space-y-5">
                                            <div className="text-center">
                                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                                    Enter the 6-digit verification code sent to
                                                </p>
                                                <p className="text-xs font-semibold text-teal-600 dark:text-teal-400">
                                                    {verifiedEmail}
                                                </p>
                                            </div>

                                            {otpSuccess && (
                                                <div className="flex items-center gap-2 p-3 bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/20 rounded-xl text-teal-700 dark:text-teal-400 text-xs">
                                                    <CheckCircle2 size={16} className="flex-shrink-0" />
                                                    <span>{otpSuccess}</span>
                                                </div>
                                            )}

                                            {otpError && (
                                                <div className="flex items-start gap-2.5 p-3.5 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-red-700 dark:text-red-400 text-sm">
                                                    <AlertCircle size={17} className="flex-shrink-0 mt-0.5" />
                                                    <span>{otpError}</span>
                                                </div>
                                            )}

                                            {/* 6 OTP Boxes */}
                                            <div className="flex items-center justify-center gap-2 sm:gap-2.5">
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
                                                        className="w-11 h-12 sm:w-12 sm:h-13 text-center text-xl sm:text-2xl font-bold bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:border-teal-500 dark:focus:border-teal-400 focus:outline-none focus:ring-4 focus:ring-teal-500/20 text-gray-900 dark:text-white transition-all shadow-sm"
                                                        value={digit}
                                                        onChange={(e) => handleOtpChange(i, e.target.value)}
                                                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                                                        autoComplete="one-time-code"
                                                    />
                                                ))}
                                            </div>

                                            <button
                                                type="submit"
                                                className="btn-primary w-full justify-center py-3 text-base font-semibold shadow-glow-teal"
                                                disabled={otpVerifying || otpDigits.some((d) => d === '')}
                                            >
                                                {otpVerifying ? (
                                                    <>
                                                        <Loader2 size={18} className="animate-spin mr-2" />
                                                        <span>Verifying & Signing in...</span>
                                                    </>
                                                ) : (
                                                    'Verify & Enter Dashboard'
                                                )}
                                            </button>

                                            {/* Resend OTP */}
                                            <div className="flex items-center justify-between text-xs pt-1 text-gray-500 dark:text-gray-400">
                                                <span>Didn&apos;t receive code?</span>
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
                                    )}

                                    <div className="text-center pt-2">
                                        <button
                                            type="button"
                                            onClick={handleSwitchToPassword}
                                            className="inline-flex items-center gap-1.5 text-xs text-teal-600 dark:text-teal-400 hover:underline font-medium"
                                        >
                                            <KeyRound size={13} />
                                            <span>Sign in with Password instead</span>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Back to Step 1 Button */}
                            <div className="pt-2 border-t border-gray-100 dark:border-gray-800 text-center">
                                <button
                                    type="button"
                                    onClick={handleBackToEmail}
                                    className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                                >
                                    <ArrowLeft size={13} />
                                    <span>Sign in with a different account</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
