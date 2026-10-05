'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { KeyRound, Lock, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, Sparkles, Copy, Check, ArrowRight, User, Mail, ShieldCheck, Clock } from 'lucide-react';

function SetPasswordForm() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const token = searchParams.get('token') || '';
    const initialEmail = searchParams.get('email') || '';

    const [email, setEmail] = useState(initialEmail);
    const [userName, setUserName] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [generatedPassword, setGeneratedPassword] = useState('');
    const [copied, setCopied] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showSuccessPopup, setShowSuccessPopup] = useState(false);
    const [savedUser, setSavedUser] = useState<{ name: string; email: string }>({
        name: 'User',
        email: initialEmail || '',
    });
    const [countdown, setCountdown] = useState(10);

    // Fetch user details from token or email if present in query parameters
    useEffect(() => {
        const queryEmail = initialEmail || searchParams.get('email') || '';
        if (queryEmail) {
            setEmail(queryEmail);
            setSavedUser((prev) => ({ ...prev, email: queryEmail }));
        }

        const fetchDetails = async () => {
            if (!token && !queryEmail) return;
            try {
                const query = token ? `token=${encodeURIComponent(token)}` : `email=${encodeURIComponent(queryEmail)}`;
                const res = await fetch(`/api/auth/set-password?${query}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.email) {
                        setEmail(data.email);
                        setSavedUser((prev) => ({ ...prev, email: data.email }));
                    }
                    if (data.name) {
                        setUserName(data.name);
                        setSavedUser((prev) => ({ ...prev, name: data.name }));
                    }
                }
            } catch (err) {
                console.error('Failed to fetch user info for password setup:', err);
            }
        };

        fetchDetails();
    }, [token, initialEmail, searchParams]);

    // 10-Second Countdown timer for automatic redirect to Login
    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (showSuccessPopup) {
            setCountdown(10);
            timer = setInterval(() => {
                setCountdown((prev) => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        router.push('/login');
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [showSuccessPopup, router]);

    const generateRandomPassword = (e?: React.MouseEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
        const lowercase = 'abcdefghijkmnopqrstuvwxyz';
        const numbers = '23456789';
        const symbols = '!@#$%^&*';

        let gen = '';
        gen += uppercase[Math.floor(Math.random() * uppercase.length)];
        gen += lowercase[Math.floor(Math.random() * lowercase.length)];
        gen += numbers[Math.floor(Math.random() * numbers.length)];
        gen += symbols[Math.floor(Math.random() * symbols.length)];

        const all = uppercase + lowercase + numbers + symbols;
        for (let i = 0; i < 6; i++) {
            gen += all[Math.floor(Math.random() * all.length)];
        }

        const finalPass = gen.split('').sort(() => 0.5 - Math.random()).join('');
        setGeneratedPassword(finalPass);
        setPassword(finalPass);
        setConfirmPassword(finalPass);
        setShowPassword(true);
        setShowConfirm(true);
        setCopied(false);
        setError('');
    };

    const handleCopyGenerated = (e?: React.MouseEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        if (!generatedPassword) return;
        navigator.clipboard.writeText(generatedPassword);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    const targetEmail = (email || initialEmail || searchParams.get('email') || '').trim();

    const handleDone = async (e?: React.FormEvent | React.MouseEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        setError('');

        if (!targetEmail) {
            setError('Please enter your email address');
            return;
        }

        if (!password) {
            setError('Please enter a password');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters long');
            return;
        }

        if (!confirmPassword) {
            setError('Please confirm your password');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match. Please re-enter.');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/auth/set-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token,
                    email: targetEmail,
                    name: userName || targetEmail.split('@')[0],
                    password,
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Failed to save password');
            }

            const finalUserName = data.user?.name || userName || targetEmail.split('@')[0];
            const finalUserEmail = data.user?.email || targetEmail;

            setSavedUser({
                name: finalUserName,
                email: finalUserEmail,
            });
            setShowSuccessPopup(true);
        } catch (err: any) {
            setError(err.message || 'Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const isMatch = password && confirmPassword && password === confirmPassword;
    const isMismatch = password && confirmPassword && password !== confirmPassword;

    return (
        <div className="relative w-full max-w-md mx-auto">
            {/* Main Form Card matching Image #47 & Image #48 */}
            <div className="p-8 w-full space-y-6 shadow-2xl border border-gray-800/80 bg-[#111827] text-white rounded-3xl">
                {/* Header Key Icon & Title */}
                <div className="text-center space-y-2">
                    <div className="inline-flex items-center justify-center p-3.5 bg-teal-500/10 rounded-2xl text-teal-400 mb-1 ring-8 ring-teal-500/5 shadow-inner">
                        <KeyRound size={28} />
                    </div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">
                        Set Password
                    </h1>
                    <p className="text-xs text-gray-400">
                        Create a secure password for your Valid8 account
                    </p>
                </div>

                {/* User Info Card or Email Input */}
                {targetEmail ? (
                    <div className="p-3.5 bg-gray-800/70 rounded-2xl border border-gray-700/60 flex items-center gap-3 shadow-sm">
                        <div className="w-10 h-10 rounded-xl bg-teal-500 text-white font-bold flex items-center justify-center text-sm shadow-md shadow-teal-500/20 flex-shrink-0">
                            {(userName || targetEmail)[0]?.toUpperCase() || 'S'}
                        </div>
                        <div className="flex-1 min-w-0">
                            {userName && (
                                <p className="text-xs font-bold text-white truncate">
                                    {userName}
                                </p>
                            )}
                            <p className="text-[12px] text-gray-300 truncate flex items-center gap-1.5 font-medium">
                                <Mail size={14} className="flex-shrink-0 text-teal-400" />
                                <span className="truncate">{targetEmail}</span>
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                            <Mail size={13} className="text-teal-400" /> Email Address
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => {
                                setEmail(e.target.value);
                                if (error) setError('');
                            }}
                            placeholder="user@company.com"
                            required
                            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-700 bg-gray-800/80 text-white text-xs outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all placeholder:text-gray-500"
                        />
                    </div>
                )}

                {/* Error Banner */}
                {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-xs animate-in fade-in">
                        <AlertCircle size={16} className="flex-shrink-0" />
                        <p>{error}</p>
                    </div>
                )}

                <form onSubmit={handleDone} className="space-y-4">
                    {/* 1. Set Password Input */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                                <Lock size={13} className="text-teal-400" /> Set Password
                            </label>
                            <button
                                type="button"
                                onClick={generateRandomPassword}
                                className="text-[11px] text-teal-400 font-semibold hover:text-teal-300 hover:underline flex items-center gap-1 cursor-pointer transition-colors"
                            >
                                <Sparkles size={12} /> Generate
                            </button>
                        </div>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => {
                                    setPassword(e.target.value);
                                    if (error) setError('');
                                }}
                                placeholder="Enter password (min 6 characters)"
                                className="w-full pl-3.5 pr-11 py-2.5 rounded-xl border border-gray-700 bg-gray-800/80 text-white text-xs outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all placeholder:text-gray-500"
                            />
                            <button
                                type="button"
                                tabIndex={-1}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setShowPassword(prev => !prev);
                                }}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 z-10 p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700/50 transition-colors cursor-pointer"
                                title={showPassword ? 'Hide password' : 'Show password'}
                            >
                                {showPassword ? <EyeOff size={16} className="text-teal-400" /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    {/* 2. Confirm Password Input */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                                <Lock size={13} className="text-teal-400" /> Confirm Password
                            </label>
                            {isMatch && (
                                <span className="text-[10px] text-teal-400 font-semibold flex items-center gap-0.5">
                                    <Check size={11} /> Passwords match
                                </span>
                            )}
                            {isMismatch && (
                                <span className="text-[10px] text-amber-400 font-medium">
                                    Does not match
                                </span>
                            )}
                        </div>
                        <div className="relative">
                            <input
                                type={showConfirm ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={(e) => {
                                    setConfirmPassword(e.target.value);
                                    if (error) setError('');
                                }}
                                placeholder="Re-enter password"
                                className={`w-full pl-3.5 pr-11 py-2.5 rounded-xl border ${isMismatch ? 'border-amber-500/60' : 'border-gray-700'} bg-gray-800/80 text-white text-xs outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all placeholder:text-gray-500`}
                            />
                            <button
                                type="button"
                                tabIndex={-1}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setShowConfirm(prev => !prev);
                                }}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 z-10 p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700/50 transition-colors cursor-pointer"
                                title={showConfirm ? 'Hide password' : 'Show password'}
                            >
                                {showConfirm ? <EyeOff size={16} className="text-teal-400" /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    {/* Generated Password Box */}
                    {generatedPassword && (
                        <div className="p-3 bg-teal-950/40 border border-teal-800/80 rounded-xl space-y-1 animate-in fade-in zoom-in-95">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-medium text-teal-300">Generated Password:</span>
                                <button
                                    type="button"
                                    onClick={handleCopyGenerated}
                                    className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 bg-teal-600 text-white rounded-md hover:bg-teal-500 transition-colors cursor-pointer"
                                >
                                    {copied ? <Check size={11} /> : <Copy size={11} />}
                                    {copied ? 'Copied' : 'Copy'}
                                </button>
                            </div>
                            <p className="font-mono text-xs font-bold text-teal-100 tracking-wider">
                                {generatedPassword}
                            </p>
                        </div>
                    )}

                    {/* Done Button */}
                    <div className="pt-3">
                        <button
                            type="button"
                            onClick={handleDone}
                            disabled={loading}
                            className="w-full py-3 bg-teal-500 hover:bg-teal-400 active:bg-teal-600 text-white rounded-xl font-bold transition-all shadow-lg shadow-teal-500/30 hover:shadow-teal-500/50 text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" /> Saving...
                                </>
                            ) : (
                                <>
                                    Done <Check size={16} />
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>

            {/* Animated Pop-up Modal on Click of Done */}
            {showSuccessPopup && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-300">
                    <div className="bg-[#111827] rounded-3xl shadow-2xl w-full max-w-md p-8 text-center space-y-6 border border-gray-800 animate-in zoom-in-95 duration-300 relative overflow-hidden text-white">
                        {/* Top Accent Gradient Line */}
                        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-teal-400 via-emerald-400 to-teal-500" />

                        {/* Animated Check Icon with Pulses */}
                        <div className="relative mx-auto w-20 h-20 flex items-center justify-center mt-2">
                            <div className="absolute inset-0 bg-teal-500/20 rounded-full animate-ping opacity-75" />
                            <div className="relative w-16 h-16 bg-gradient-to-tr from-teal-600 to-teal-400 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-teal-500/40">
                                <CheckCircle2 size={36} />
                            </div>
                        </div>

                        {/* Heading & Subtext */}
                        <div className="space-y-1.5">
                            <h2 className="text-2xl font-bold text-white">
                                Password Created Successfully!
                            </h2>
                            <p className="text-xs text-gray-400">
                                Your account password has been encrypted & stored in the database.
                            </p>
                        </div>

                        {/* User Details Card */}
                        <div className="bg-gray-800/80 rounded-2xl p-4 border border-gray-700/80 text-left space-y-3 shadow-inner">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-teal-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                                    <User size={18} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Username</span>
                                    <p className="text-sm font-bold text-white truncate">
                                        {savedUser.name || 'User'}
                                    </p>
                                </div>
                            </div>

                            <div className="h-px bg-gray-700/60" />

                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-teal-500/15 text-teal-400 flex items-center justify-center flex-shrink-0">
                                    <Mail size={18} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Email ID</span>
                                    <p className="text-xs font-semibold text-gray-200 truncate">
                                        {savedUser.email || targetEmail}
                                    </p>
                                </div>
                            </div>

                            <div className="pt-1 flex items-center justify-between text-[11px] text-teal-300 font-medium">
                                <span className="flex items-center gap-1">
                                    <ShieldCheck size={14} className="text-teal-400" /> Database Status:
                                </span>
                                <span className="px-2 py-0.5 bg-teal-500/20 rounded-full text-teal-300 font-semibold text-[10px]">
                                    Hashed & Saved
                                </span>
                            </div>
                        </div>

                        {/* Animated 10-Second Countdown Indicator */}
                        <div className="p-3 bg-gray-800/50 rounded-xl border border-gray-700/50 flex items-center justify-center gap-2 text-xs text-gray-300">
                            <Clock size={15} className="text-teal-400 animate-spin" />
                            <span>Redirecting to login in <strong className="text-teal-400 text-sm font-mono">{countdown}s</strong>...</span>
                        </div>

                        {/* Action Button */}
                        <div className="pt-1">
                            <button
                                type="button"
                                onClick={() => router.push('/login')}
                                className="w-full py-3 bg-teal-500 hover:bg-teal-400 active:bg-teal-600 text-white rounded-xl font-bold transition-all shadow-lg shadow-teal-500/30 flex items-center justify-center gap-2 text-sm cursor-pointer"
                            >
                                Go to Login Now <ArrowRight size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function SetPasswordPage() {
    return (
        <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center p-4">
            <Suspense fallback={
                <div className="p-8 max-w-md w-full flex items-center justify-center bg-[#111827] rounded-3xl">
                    <Loader2 size={32} className="text-teal-500 animate-spin" />
                </div>
            }>
                <SetPasswordForm />
            </Suspense>
        </div>
    );
}
