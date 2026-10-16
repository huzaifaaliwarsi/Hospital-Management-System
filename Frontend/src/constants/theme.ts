/**
 * Centralized Design System & Theme Tokens for CH Sharif and Saeed Hospital HMS
 * Developed by iSysware Software Solutions
 */

export const THEME_COLORS = {
  // Brand Primary Green
  primary: '#129b70',
  primaryHover: '#0e7d5a',
  primaryDark: '#0b6649',
  primarySoft: '#effaf5',
  primaryMint: '#e3f6ee',
  primaryLight: '#c2e7db',

  // Light Navigation Theme (White + Light Mint)
  sidebarBg: '#ffffff',
  sidebarSurface: '#f6faf8',
  sidebarBorder: '#e2eae5',
  sidebarText: '#1f2937',
  sidebarTextMuted: '#52665e',
  sidebarLabel: '#8b9e95',
  sidebarHover: '#f0faf6',
  sidebarActive: '#dff5ea',
  sidebarActiveText: '#0e7d5a',
  sidebarActiveIcon: '#129b70',
  sidebarActiveBorder: '#129b70',

  // Main Surfaces & Neutrals
  pageBg: '#f6faf8',
  cardBg: '#ffffff',
  cardBorder: '#e2eae5',
  cardBorderLight: '#eef3f0',
  inputBg: '#ffffff',
  inputBorder: '#d2ded8',

  // Typography
  textPrimary: '#111827',
  textSecondary: '#52665e',
  textMuted: '#8b9e95',

  // Semantic Status Colors
  success: '#129b70',
  successSoft: '#e7f6f1',
  warning: '#f59e0b',
  warningSoft: '#fef3c7',
  danger: '#ef4444',
  dangerSoft: '#fee2e2',
  info: '#2563eb',
  infoSoft: '#eff6ff',
} as const;

export const THEME_TYPOGRAPHY = {
  fontFamily: "'Poppins', sans-serif",
  weights: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const;

export const THEME_RADII = {
  sm: 'rounded-md',    // 6px
  md: 'rounded-lg',    // 8px
  lg: 'rounded-xl',    // 12px
  xl: 'rounded-2xl',   // 16px
  full: 'rounded-full',
} as const;

export const THEME_SHADOWS = {
  subtle: 'shadow-[0_1px_3px_rgba(0,0,0,0.04)]',
  card: 'shadow-[0_1px_3px_rgba(0,0,0,0.05),0_1px_2px_rgba(0,0,0,0.03)]',
  dropdown: 'shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1),0_8px_10px_-6px_rgba(0,0,0,0.1)]',
  modal: 'shadow-[0_20px_40px_-15px_rgba(0,0,0,0.2)]',
} as const;

// Common reusable Tailwind class combinations adhering to the green design tokens
export const THEME_CLASSES = {
  // Buttons
  primaryBtn: 'bg-[#129b70] hover:bg-[#0e7d5a] text-white font-semibold rounded-lg transition-colors shadow-xs',
  secondaryBtn: 'bg-white border border-[#d2ded8] text-[#111827] hover:bg-[#f6f8f7] font-medium rounded-lg transition-colors',
  dangerBtn: 'bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg transition-colors shadow-xs',
  
  // Inputs & Controls
  input: 'bg-white border border-[#d2ded8] rounded-lg px-3 py-2 text-sm text-[#111827] placeholder:text-[#8b9e95] focus:outline-hidden focus:border-[#129b70] focus:ring-2 focus:ring-[#129b70]/20 transition-all',
  
  // Cards
  card: 'bg-white rounded-xl border border-[#e2eae5] shadow-[0_1px_3px_rgba(0,0,0,0.04)]',
  
  // Badges
  badgeSuccess: 'bg-[#e7f6f1] text-[#0e7d5a] border border-[#c2e7db]',
  badgeWarning: 'bg-amber-50 text-amber-800 border border-amber-200',
  badgeDanger: 'bg-rose-50 text-rose-800 border border-rose-200',
  badgeNeutral: 'bg-slate-100 text-slate-700 border border-slate-200',
} as const;
