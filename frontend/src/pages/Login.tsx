import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { HardHat, Eye, EyeOff, Lock, Mail, ArrowRight, Loader2 } from 'lucide-react';

interface LoginProps {
  onNavigate: (page: string) => void;
}

export const Login: React.FC<LoginProps> = ({ onNavigate }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('sarvesh.gupta@pranavconstructions.com');
  const [password, setPassword] = useState('password');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await login(email, password);
      onNavigate('dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen bg-[#f3f4f6] dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex items-center justify-center p-4 transition-colors">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 shadow-sm space-y-8 animate-scale-in">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-slate-900 dark:bg-indigo-600 text-white font-bold flex items-center justify-center mx-auto shadow-xs">
            <HardHat className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Digi<span className="text-indigo-600 dark:text-indigo-400">QC</span> Platform
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Sign in to access your construction quality control workspace
          </p>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/80 rounded-lg text-xs text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Work Email Address</label>
            <div className="flex items-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-slate-100 transition">
              <Mail className="w-4 h-4 text-slate-400 dark:text-slate-500 mr-2 shrink-0" />
              <input
                type="email"
                required
                placeholder="sarvesh.gupta@pranavconstructions.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="bg-transparent border-none outline-none w-full placeholder-slate-400 dark:placeholder-slate-500"
                id="login-email-input"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Password</label>
            <div className="flex items-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-slate-100 transition">
              <Lock className="w-4 h-4 text-slate-400 dark:text-slate-500 mr-2 shrink-0" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="bg-transparent border-none outline-none w-full placeholder-slate-400 dark:placeholder-slate-500"
                id="login-password-input"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-500 text-white font-semibold text-xs rounded-lg shadow-xs flex items-center justify-center gap-2 transition"
            id="login-submit-btn"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>Sign In to Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="text-center pt-2 border-t border-slate-100">
          <p className="text-xs text-slate-500">
            Don't have an account?{' '}
            <button
              onClick={() => onNavigate('register')}
              className="font-bold text-indigo-600 hover:underline"
            >
              Register Organization
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
