/**
 * Theme color constants for Inspectify
 * Light Mode: Red (#FF2D55) and White with black text
 * Dark Mode: Black and Red (#FF2D55) with white text
 */

import '@/global.css';
import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#09090B',
    background: '#FFFFFF',
    backgroundElement: '#F4F4F6',
    backgroundSelected: '#E4E4E7',
    textSecondary: '#71717A',
    tint: '#FF2D55',
    tabIconDefault: '#A1A1AA',
    tabIconSelected: '#FF2D55',
    border: '#E4E4E7',
    card: '#FFFFFF',
  },
  dark: {
    text: '#FFFFFF',
    background: '#000000',
    backgroundElement: '#111114',
    backgroundSelected: '#1C1C20',
    textSecondary: '#A1A1AA',
    tint: '#FF2D55',
    tabIconDefault: '#71717A',
    tabIconSelected: '#FF2D55',
    border: '#27272A',
    card: '#111114',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
