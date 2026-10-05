export const colors = {
  // Light Theme (Default - Tangerine Dream Clean Mode)
  background: {
    primary: '#FFFFFF',
    secondary: '#F8F9FA',
    tertiary: '#F3F4F6',
    surface: '#FFFFFF',
    card: '#FFFFFF',
    overlay: 'rgba(0, 0, 0, 0.4)',
    dark: '#0D0D0D',
  },
  accent: {
    primary: '#FF4B33', // Tangerine Red-Orange
    hover: '#E03E27',
    muted: 'rgba(255, 75, 51, 0.12)',
    glow: 'rgba(255, 75, 51, 0.25)',
    warm: '#f97316',
  },
  text: {
    primary: '#0D0D0D',
    secondary: '#4B5563',
    muted: '#6B7280',
    subtle: '#9CA3AF',
    inverse: '#FFFFFF',
    accent: '#FF4B33',
  },
  border: {
    subtle: '#F3F4F6',
    default: '#E5E7EB',
    strong: '#D1D5DB',
    focus: '#FF4B33',
  },
  status: {
    success: '#16A34A',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
  },
  chat: {
    incomingBg: '#FFFFFF',
    incomingBorder: '#E7EAF0',
    incomingText: '#1E2430',
    outgoingBg: '#FF4B33',
    outgoingText: '#FFFFFF',
    appBg: '#F5F7FB',
  },
  glass: {
    bgColors: ['rgba(255, 255, 255, 0.85)', 'rgba(248, 249, 250, 0.45)'],
    bgDarkColors: ['rgba(15, 15, 15, 0.85)', 'rgba(30, 30, 30, 0.45)'],
    borderColor: 'rgba(255, 255, 255, 0.4)',
    borderDarkColor: 'rgba(255, 255, 255, 0.1)',
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const borderRadius = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  full: 9999,
} as const;

export const typography = {
  fontFamily: {
    sans: 'WorkSans-Regular',
    sansMedium: 'WorkSans-Medium',
    sansSemiBold: 'WorkSans-SemiBold',
    sansBold: 'WorkSans-Bold',
    sansExtraBold: 'WorkSans-ExtraBold',
    serif: 'Lora-Regular',
    serifMedium: 'Lora-Medium',
    serifSemiBold: 'Lora-SemiBold',
    serifBold: 'Lora-Bold',
    mono: 'Inconsolata-Regular',
    monoBold: 'Inconsolata-Bold',
  },
  fontSize: {
    xxs: 10,
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    black: '900',
  },
} as const;

export const shadows = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  dropdown: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;
