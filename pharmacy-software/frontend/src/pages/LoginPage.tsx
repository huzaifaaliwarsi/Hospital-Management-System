import React, { useState } from 'react';
import { Building2, Lock, User as UserIcon, Eye, EyeOff, ArrowRight, AlertCircle, Check, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

/** Dev/testing convenience only — real credentials for this environment's seeded accounts (pharmacy.md §13 role hierarchy). */
const DEMO_ACCOUNTS = [
  { role: 'Super Admin', username: 'superadmin', password: 'SuperAdmin@2026New' },
  { role: 'Admin', username: 'admin1', password: 'Admin@2026New' },
  { role: 'Sales / Dispensing', username: 'sales1', password: 'Sales@12345' },
];

export const LoginPage: React.FC = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showDemoAccounts, setShowDemoAccounts] = useState(false);

  const { login } = useAuth();
  const toast = useToast();

  const handleAutofill = (username: string, pwd: string) => {
    setIdentifier(username);
    setPassword(pwd);
    setErrorMessage(null);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!identifier.trim()) {
      setErrorMessage('Please enter your username or email.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsLoading(true);
    try {
      await login(identifier.trim(), password);
      toast.success('Signed in successfully.', 'Authentication Verified');
    } catch (err: any) {
      const message = err?.response?.data?.error?.message || 'Invalid username or password.';
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#f6f8f7] font-sans antialiased text-[#111827]">
      {/* LEFT PANEL — branded */}
      <div className="w-full lg:w-[68%] xl:w-[70%] bg-[#129b70] text-white flex flex-col justify-between p-8 sm:p-12 lg:p-16 xl:p-20 relative overflow-hidden shrink-0">
        <div className="absolute -right-24 -bottom-24 w-96 h-96 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute right-12 top-12 w-64 h-64 rounded-full bg-emerald-400/10 blur-2xl pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-xl bg-white/15 border border-white/25 backdrop-blur-xs flex items-center justify-center shrink-0">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <span className="text-xs font-semibold tracking-wider text-emerald-100 uppercase block">Standalone Pharmacy</span>
              <span className="text-sm font-bold text-white tracking-tight">Pharmacy Management Software</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 my-10 lg:my-auto max-w-xl">
          <h1 className="text-3xl sm:text-4xl xl:text-5xl font-bold tracking-tight text-white leading-tight">Pharmacy Management Software</h1>
          <p className="text-lg sm:text-xl font-medium text-emerald-100 mt-2 tracking-tight">Management + Sales Portal</p>
          <p className="text-base sm:text-lg text-emerald-50/90 mt-5 leading-relaxed font-normal">
            Medicines, batches, POS, vendors, HMS medicine requests and cash accountability — in one place.
          </p>
          <div className="mt-8 sm:mt-10 space-y-4">
            {['Live FEFO batch/expiry stock control', 'Real POS with tax, discount and split payment', 'Vendor Ledger and per-user cash accountability'].map((line) => (
              <div key={line} className="flex items-center gap-3 text-white font-medium text-sm sm:text-base">
                <div className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center shrink-0 border border-white/30">
                  <Check className="h-3.5 w-3.5 text-white stroke-[2.5]" />
                </div>
                <span>{line}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 pt-6 border-t border-white/15 text-xs text-emerald-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span>&copy; 2026 Standalone Pharmacy Software</span>
          <span className="text-emerald-50 font-medium">Powered by iSysware Software Solutions</span>
        </div>
      </div>

      {/* RIGHT PANEL — auth form */}
      <div className="w-full lg:w-[32%] xl:w-[30%] bg-white flex flex-col justify-between p-6 sm:p-8 lg:p-10 xl:p-12 overflow-y-auto shadow-xl lg:shadow-none border-l border-[#e2eae5]">
        <div>
          <div className="flex items-center gap-2.5 pb-6 border-b border-[#e2eae5]/70">
            <div className="h-8 w-8 rounded-lg bg-[#129b70] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">RX</div>
            <div>
              <div className="text-xs font-bold text-[#111827] leading-tight">Pharmacy Management Software</div>
              <div className="text-[10px] text-[#52665e] font-medium">Authorized Personnel Workstation</div>
            </div>
          </div>

          <div className="mt-8 mb-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#111827] tracking-tight">Welcome back</h2>
            <p className="text-xs sm:text-sm text-[#52665e] mt-1.5 font-normal">Sign in to your account to continue.</p>
          </div>

          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-2.5 text-xs leading-relaxed">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <strong className="font-semibold block text-rose-950">Access Denied</strong>
                <span>{errorMessage}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label htmlFor="identifier" className="block text-xs font-semibold text-[#111827] mb-1.5">Username / Email</label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94a3b8]" />
                <input
                  id="identifier"
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Enter username or email"
                  className="w-full h-10 pl-9 pr-3 text-sm bg-white border border-[#e2eae5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#129b70]/20 focus:border-[#129b70]"
                  autoComplete="username"
                />
              </div>
            </div>
            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-[#111827] mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94a3b8]" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full h-10 pl-9 pr-9 text-sm bg-white border border-[#e2eae5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#129b70]/20 focus:border-[#129b70]"
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#52665e]">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-10 flex items-center justify-center gap-2 rounded-lg bg-[#129b70] hover:bg-[#0e7d5a] text-white text-sm font-semibold transition-colors disabled:opacity-60"
            >
              {isLoading ? 'Signing in…' : 'Login to Portal'} {!isLoading && <ArrowRight className="h-4 w-4" />}
            </button>
          </form>

          {/* Dev/testing quick-fill — remove before real deployment */}
          <div className="mt-6 pt-5 border-t border-[#e2eae5]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-[#52665e] uppercase tracking-wider">Demo Accounts</span>
              <button
                type="button"
                onClick={() => setShowDemoAccounts((v) => !v)}
                className="text-[11px] font-semibold text-[#129b70] hover:text-[#0e7d5a] flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="h-3 w-3" />
                <span>{showDemoAccounts ? 'Hide Quick Fill' : '1-Click Autofill'}</span>
              </button>
            </div>

            {showDemoAccounts && (
              <div className="p-3 bg-[#f6f8f7] rounded-lg border border-[#e2eae5] space-y-1.5 text-xs">
                <p className="text-[11px] text-[#52665e] mb-1.5">Select a role to test — fills the form, you still press Login:</p>
                {DEMO_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.username}
                    type="button"
                    onClick={() => handleAutofill(acc.username, acc.password)}
                    className="w-full p-1.5 text-left rounded-md bg-white hover:bg-[#e7f6f1] border border-[#e2eae5] hover:border-[#c2e7db] transition-colors cursor-pointer flex items-center justify-between"
                  >
                    <span>
                      <span className="font-semibold text-[#111827] text-xs">{acc.role}</span>
                      <span className="block text-[10px] text-[#8b9e95]">User: {acc.username}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <p className="text-[10.5px] text-[#94a3b8] mt-8 text-center">
          Internal pharmacy management system. Unauthorized access is strictly prohibited.
        </p>
      </div>
    </div>
  );
};
