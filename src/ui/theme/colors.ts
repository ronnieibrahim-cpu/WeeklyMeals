/**
 * Semantic color palette for light and dark mode.
 * Apple-like neutral surfaces with a single warm "Paprika" accent.
 * Components reference semantic names (e.g. colors.text), never raw hex.
 */

export interface ThemeColors {
  background: string;
  backgroundSecondary: string;
  card: string;
  cardElevated: string;
  border: string;
  separator: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  accent: string;
  accentMuted: string;
  onAccent: string;
  success: string;
  warning: string;
  danger: string;
  star: string;
  overlay: string;
  tabBar: string;
  tabBarInactive: string;
  skeleton: string;
}

export const lightColors: ThemeColors = {
  background: '#FFFFFF',
  backgroundSecondary: '#F2F2F7',
  card: '#FFFFFF',
  cardElevated: '#FFFFFF',
  border: '#E5E5EA',
  separator: '#ECECEF',
  text: '#11181C',
  textSecondary: '#60646C',
  textTertiary: '#9BA1A6',
  accent: '#FF6B35',
  accentMuted: 'rgba(255, 107, 53, 0.12)',
  onAccent: '#FFFFFF',
  success: '#34C759',
  warning: '#FF9F0A',
  danger: '#FF3B30',
  star: '#FF9F0A',
  overlay: 'rgba(0, 0, 0, 0.4)',
  tabBar: '#FFFFFF',
  tabBarInactive: '#9BA1A6',
  skeleton: '#ECECEF',
};

export const darkColors: ThemeColors = {
  background: '#000000',
  backgroundSecondary: '#1C1C1E',
  card: '#1C1C1E',
  cardElevated: '#2C2C2E',
  border: '#38383A',
  separator: '#2C2C2E',
  text: '#ECEDEE',
  textSecondary: '#B0B4BA',
  textTertiary: '#687076',
  accent: '#FF7A45',
  accentMuted: 'rgba(255, 122, 69, 0.18)',
  onAccent: '#FFFFFF',
  success: '#30D158',
  warning: '#FFD60A',
  danger: '#FF453A',
  star: '#FFD60A',
  overlay: 'rgba(0, 0, 0, 0.6)',
  tabBar: '#0A0A0A',
  tabBarInactive: '#687076',
  skeleton: '#2C2C2E',
};
