import React, { useState } from 'react';
import { Timeframe, UserProfileData } from '../types/market';
import {
  X,
  UserCheck,
  LogIn,
  UserPlus,
  Settings,
  RefreshCw,
  LogOut,
  ShieldCheck,
  Chrome,
} from 'lucide-react';

interface AuthProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfileData | null;
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string, displayName: string) => Promise<void>;
  onGoogleSignIn: () => Promise<void>;
  onUpdateProfile: (updates: Partial<UserProfileData>) => Promise<void>;
  onLogout: () => void;
  refreshIntervalSec: number;
  onChangeRefreshInterval: (sec: number) => void;
}

export const AuthProfileModal: React.FC<AuthProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  onLogin,
  onRegister,
  onGoogleSignIn,
  onUpdateProfile,
  onLogout,
  refreshIntervalSec,
  onChangeRefreshInterval,
}) => {
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || 'Quantitative Equities & Market Structure Research');
  const [defaultTf, setDefaultTf] = useState<Timeframe>(user?.defaultTimeframe || '3M');
  const [defaultChart, setDefaultChart] = useState<'candlestick' | 'line'>(
    user?.defaultChartType || 'candlestick'
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setBusy(true);
    try {
      if (authTab === 'login') {
        await onLogin(email, password);
        setSuccessMsg('Signed in successfully. Your watchlist, alerts, and preferences are synced.');
      } else {
        await onRegister(email, password, displayName);
        setSuccessMsg('Account created and persisted.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setBusy(true);
    try {
      await onUpdateProfile({
        displayName,
        bio,
        refreshIntervalSec,
        defaultTimeframe: defaultTf,
        defaultChartType: defaultChart,
      });
      setSuccessMsg('Profile and real-time refresh preferences saved.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save profile.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="bg-[#0e131b] border border-[#242f42] rounded-md w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1c2433] bg-[#131924]">
          <div className="flex items-center gap-2">
            {user ? (
              <UserCheck className="w-5 h-5 text-[#00E676]" />
            ) : (
              <Settings className="w-5 h-5 text-[#00E5FF]" />
            )}
            <div>
              <h2 className="text-sm font-bold text-white">
                {user ? `QuantPulse Account · ${user.displayName}` : 'QuantPulse Authentication & Preferences'}
              </h2>
              <p className="text-[11px] text-slate-400">
                Persistent Watchlists, Custom Alerts, Screener Presets & Auto-Refresh
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
          {/* Global Real-Time Data Refreshing Configuration */}
          <div className="bg-[#11161f] p-3.5 rounded border border-[#1c2433]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                <RefreshCw className="w-3.5 h-3.5 text-[#00E5FF]" />
                <span>Real-Time Market Data Auto-Refresh Interval</span>
              </div>
              <span className="text-[11px] font-mono text-[#00E5FF]">
                {refreshIntervalSec === 0 ? 'PAUSED' : `Every ${refreshIntervalSec}s`}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mb-2.5">
              Automatically updates stock prices, candlestick charts, technical indicators, and market sentiment metrics without manual intervention.
            </p>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: '15s (Fast)', val: 15 },
                { label: '30s (Std)', val: 30 },
                { label: '60s', val: 60 },
                { label: 'Paused', val: 0 },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => onChangeRefreshInterval(opt.val)}
                  className={`py-1.5 px-2 text-xs font-mono rounded border transition-colors ${
                    refreshIntervalSec === opt.val
                      ? 'bg-[#00E5FF]/15 border-[#00E5FF] text-[#00E5FF] font-semibold'
                      : 'bg-[#090c11] border-[#242f42] text-slate-400 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded bg-[#FF4D4D]/15 border border-[#FF4D4D]/40 text-xs text-[#FF4D4D]">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded bg-[#00E676]/15 border border-[#00E676]/40 text-xs text-[#00E676]">
              {successMsg}
            </div>
          )}

          {!user ? (
            /* Sign In / Sign Up Form */
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 bg-[#090c11] p-1 rounded border border-[#1c2433]">
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab('login');
                    setErrorMsg(null);
                  }}
                  className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded transition-colors ${
                    authTab === 'login'
                      ? 'bg-[#182030] text-[#00E5FF]'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  Log In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab('register');
                    setErrorMsg(null);
                  }}
                  className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded transition-colors ${
                    authTab === 'register'
                      ? 'bg-[#182030] text-[#00E5FF]'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Create Account
                </button>
              </div>

              <form onSubmit={handleAuthSubmit} className="space-y-3">
                {authTab === 'register' && (
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">
                      Display Name / Analyst Handle
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={80}
                      placeholder="e.g. Viraj Kumar"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full bg-[#090c11] border border-[#242f42] rounded px-3 py-2 text-xs text-white focus:border-[#00E5FF] outline-none"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs text-slate-300 mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    maxLength={254}
                    placeholder="analyst@quantpulse.io"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#090c11] border border-[#242f42] rounded px-3 py-2 text-xs text-white focus:border-[#00E5FF] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    Password (PBKDF2-SHA512 Encrypted)
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Minimum 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#090c11] border border-[#242f42] rounded px-3 py-2 text-xs text-white focus:border-[#00E5FF] outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-2.5 bg-[#00E5FF] text-slate-950 font-semibold text-xs rounded hover:bg-[#00E5FF]/90 transition-colors disabled:opacity-50"
                >
                  {busy
                    ? 'Authenticating...'
                    : authTab === 'login'
                    ? 'Sign In to QuantPulse'
                    : 'Create Persistent QuantPulse Account'}
                </button>
              </form>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-[#1c2433]" />
                <span className="flex-shrink mx-3 text-[11px] text-slate-500">OR</span>
                <div className="flex-grow border-t border-[#1c2433]" />
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setErrorMsg(null);
                  setBusy(true);
                  try {
                    await onGoogleSignIn();
                    setSuccessMsg('Signed in with Google.');
                  } catch (err: any) {
                    setErrorMsg(err.message || 'Google Sign-In failed.');
                  } finally {
                    setBusy(false);
                  }
                }}
                className="w-full flex items-center justify-center gap-2 py-2 bg-[#141b26] border border-[#263246] text-slate-200 hover:text-white hover:border-slate-500 rounded text-xs font-medium transition-colors"
              >
                <Chrome className="w-4 h-4 text-[#00E5FF]" />
                <span>Continue with Google Sign-In (Firebase Auth)</span>
              </button>

              <div className="flex items-center gap-2 text-[11px] text-slate-500 pt-1">
                <ShieldCheck className="w-4 h-4 text-[#00E676] shrink-0" />
                <span>
                  Credentials are salted and hashed with PBKDF2-SHA512. Watchlists, alerts, and preferences persist across sessions.
                </span>
              </div>
            </div>
          ) : (
            /* Logged-In Profile & Workspace Preferences Management */
            <form onSubmit={handleProfileSave} className="space-y-3.5">
              <div className="bg-[#11161f] p-3 rounded border border-[#1c2433] flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-white">{user.email}</div>
                  <div className="text-[11px] font-mono text-slate-400">
                    UID: {user.uid} · {user.watchlist.length} Watchlist Symbols · {user.alerts.length} Alerts
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onLogout}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#FF4D4D]/15 border border-[#FF4D4D]/40 text-[#FF4D4D] text-xs font-medium hover:bg-[#FF4D4D]/25 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">Display Name</label>
                <input
                  type="text"
                  required
                  maxLength={80}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-[#090c11] border border-[#242f42] rounded px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Research Mandate / Bio (Max 300 chars)
                </label>
                <textarea
                  rows={2}
                  maxLength={300}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full bg-[#090c11] border border-[#242f42] rounded px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Default Timeframe</label>
                  <select
                    value={defaultTf}
                    onChange={(e) => setDefaultTf(e.target.value as Timeframe)}
                    className="w-full bg-[#090c11] border border-[#242f42] rounded px-3 py-2 text-xs font-mono text-white"
                  >
                    {(['1D', '1W', '1M', '3M', '6M', '1Y'] as Timeframe[]).map((tf) => (
                      <option key={tf} value={tf}>
                        {tf}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Default Chart Mode</label>
                  <select
                    value={defaultChart}
                    onChange={(e) => setDefaultChart(e.target.value as 'candlestick' | 'line')}
                    className="w-full bg-[#090c11] border border-[#242f42] rounded px-3 py-2 text-xs text-white"
                  >
                    <option value="candlestick">Candlestick (OHLC)</option>
                    <option value="line">Close Price Line</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 bg-[#00E5FF] text-slate-950 font-semibold text-xs rounded hover:bg-[#00E5FF]/90 transition-colors"
              >
                {busy ? 'Saving...' : 'Save Profile & Persist Preferences'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
