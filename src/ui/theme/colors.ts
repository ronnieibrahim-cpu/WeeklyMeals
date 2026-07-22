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
  backgroundSecondary: '#F7F8F5',
  card: '#FFFFFF',
  cardElevated: '#FFFFFF',
  border: '#E1E4DE',
  separator: '#EDF0EA',
  text: '#14171A',
  textSecondary: '#5B6169',
  textTertiary: '#8A9099',
  accent: '#2E8B4E',
  accentMuted: 'rgba(46, 139, 78, 0.12)',
  onAccent: '#FFFFFF',
  success: '#3FA65B',
  warning: '#F5A623',
  danger: '#E5484D',
  star: '#F5A623',
  overlay: 'rgba(0, 0, 0, 0.4)',
  tabBar: '#FFFFFF',
  tabBarInactive: '#9AA099',
  skeleton: '#EDF0EA',
};

export const darkColors: ThemeColors = {
  background: '#101312',
  backgroundSecondary: '#1B1F1D',
  card: '#1B1F1D',
  cardElevated: '#22261F',
  border: '#33372F',
  separator: '#262A24',
  text: '#ECEDEE',
  textSecondary: '#B0B4BA',
  textTertiary: '#8A9088',
  accent: '#4FBE6E',
  accentMuted: 'rgba(79, 190, 110, 0.18)',
  onAccent: '#FFFFFF',
  success: '#57C97A',
  warning: '#FFC24D',
  danger: '#FF5A54',
  star: '#FFC24D',
  overlay: 'rgba(0, 0, 0, 0.6)',
  tabBar: '#0A0A0A',
  tabBarInactive: '#6E756B',
  skeleton: '#262A24',
};
