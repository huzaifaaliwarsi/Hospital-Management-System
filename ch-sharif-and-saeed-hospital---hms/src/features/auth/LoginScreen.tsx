import React, { useState } from 'react';
import {
  ShieldCheck,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ArrowRight,
  HeartPulse,
  Building2,
  PhoneCall,
  CheckCircle2,
} from 'lucide-react';
import { HOSPITAL_INFO, SOFTWARE_PROVIDER, DEFAULT_MOCK_USER } from '../../constants';
import { Modal } from '../../components/common/Modal';
import { useToast } from '../../context/ToastContext';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('superadmin@sharif-saeed.hospital');
  const [password, setPassword] = useState('••••••••••••');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);

  const toast = useToast();

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      toast.success(
        `Welcome back, ${DEFAULT_MOCK_USER.name}. Initialized Super Admin session.`,
        'Authentication Verified'
      );
      onLoginSuccess();
    }, 700);
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) {
      toast.error('Please provide your registered hospital staff email.');
      return;
    }
    setResetSent(true);
    toast.info(`Recovery ticket dispatched for ${resetEmail}`, 'Password Reset Request');
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-between antialiased selection:bg-blue-600 selection:text-white relative overflow-hidden">
      {/* Subtle background hospital geometry */}
      <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:24px_24px]" />

      {/* Hospital Top Bar */}
      <header className="relative z-10 w-full px-6 py-4 flex items-center justify-between border-b border-slate-800 bg-slate-950/60 backdrop-blur-xs">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-md">
            CSS
          </div>
          <div>
            <h1 className="text-xs font-bold text-white tracking-wide">
              {HOSPITAL_INFO.name}
            </h1>
            <p className="text-[10px] text-slate-400">
              Hospital Management Information System (HMIS)
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-4 text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <PhoneCall className="h-3 w-3 text-emerald-400" />
            24/7 IT Desk: ext 1004
          </span>
          <span className="px-2 py-0.5 rounded bg-blue-900/60 text-blue-300 border border-blue-800/80 font-mono text-[10px]">
            SECURE PORTAL
          </span>
        </div>
      </header>

      {/* Main Login Card Container */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
          {/* Card Header with Hospital Banner */}
          <div className="px-8 pt-8 pb-6 bg-gradient-to-b from-blue-50/70 to-white border-b border-slate-100 text-center">
            {/* Hospital Logo Emblem */}
            <div className="mx-auto mb-3 h-14 w-14 rounded-2xl bg-blue-900 text-white flex items-center justify-center shadow-lg ring-4 ring-blue-100">
              <HeartPulse className="h-8 w-8 text-blue-300" />
            </div>

            <h2 className="text-xl font-bold text-slate-900">Hospital Portal Sign In</h2>
            <p className="text-xs text-slate-500 mt-1">
              Authorized access for clinical, administrative, and operational personnel
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSignIn} className="p-8 space-y-4">
            {/* Quick test credentials banner */}
            <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200/80 text-[11px] text-blue-900 flex items-center justify-between">
              <div>
                <span className="font-bold">Test Account: </span>
                <span>Super Admin</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEmail('superadmin@sharif-saeed.hospital');
                  setPassword('••••••••••••');
                }}
                className="text-xs font-semibold text-blue-700 underline hover:text-blue-900"
              >
                Auto-fill
              </button>
            </div>

            {/* Email / Username Field */}
            <div className="space-y-1">
              <label
                htmlFor="login-email"
                className="block text-xs font-semibold text-slate-700"
              >
                Username or Staff Email <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  id="login-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@sharif-saeed.hospital"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 transition-colors"
                />
              </div>
            </div>

            {/* Password Field with Show/Hide */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="login-password"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Password <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-xs text-blue-800 hover:text-blue-950 font-semibold hover:underline"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter hospital password"
                  className="w-full pl-9 pr-10 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me Checkbox */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-blue-900 focus:ring-blue-900/20"
                />
                <span className="text-xs text-slate-600">Remember this workstation</span>
              </label>

              <span className="text-[10px] text-slate-400 font-mono">TLS 1.3 / 256-bit</span>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-lg bg-blue-900 hover:bg-blue-800 text-white font-semibold text-xs shadow-md transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-75 cursor-pointer mt-2"
            >
              {isLoading ? (
                <>
                  <div className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign In to System</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Access Policy Notice */}
          <div className="px-8 py-3.5 bg-slate-50 border-t border-slate-100 text-center">
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Protected by Hospital Electronic Security Protocols. Unauthorized access attempts are monitored and recorded in audit logs.
            </p>
          </div>
        </div>
      </main>

      {/* Footer Branding */}
      <footer className="relative z-10 w-full px-6 py-4 border-t border-slate-800 bg-slate-950/80 text-center text-xs text-slate-400">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            © {new Date().getFullYear()} {HOSPITAL_INFO.name}. All rights reserved.
          </span>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <span>Powered by</span>
            <strong className="text-slate-200 font-semibold">{SOFTWARE_PROVIDER.name}</strong>
            <span className="text-slate-500">({SOFTWARE_PROVIDER.version})</span>
          </div>
        </div>
      </footer>

      {/* Forgot Password Modal Placeholder */}
      <Modal
        isOpen={showForgotPassword}
        onClose={() => {
          setShowForgotPassword(false);
          setResetSent(false);
        }}
        title="Hospital Staff Password Recovery"
        subtitle="Submit your verified official email to request an admin password reset"
        maxWidth="md"
        footer={
          resetSent ? (
            <button
              type="button"
              onClick={() => {
                setShowForgotPassword(false);
                setResetSent(false);
              }}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-900 text-white hover:bg-blue-800"
            >
              Close
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setShowForgotPassword(false)}
                className="px-4 py-2 text-xs font-semibold rounded-lg text-slate-700 bg-white border border-slate-300 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetPassword}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-900 text-white hover:bg-blue-800 shadow-xs"
              >
                Send Reset Ticket
              </button>
            </>
          )
        }
      >
        {resetSent ? (
          <div className="text-center py-4 space-y-2">
            <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <p className="text-xs font-semibold text-slate-900">
              Reset Instructions Dispatched
            </p>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              If {resetEmail} is registered in the staff directory, a secure one-time verification link has been delivered to your inbox.
            </p>
          </div>
        ) : (
          <div className="space-y-3 py-1">
            <p className="text-xs text-slate-600 leading-relaxed">
              Enter your registered staff email address below. Hospital IT administration will verify your employee identity code before resetting credentials.
            </p>
            <div className="space-y-1">
              <label htmlFor="reset-email" className="text-xs font-semibold text-slate-700">
                Hospital Staff Email
              </label>
              <input
                id="reset-email"
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="doctor@sharif-saeed.hospital"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
