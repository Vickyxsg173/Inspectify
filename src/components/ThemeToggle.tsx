import React from 'react';
import { Pressable, Appearance } from 'react-native';
import { Sun, Moon } from 'lucide-react-native';
import { useColorScheme, colorScheme as nwColorScheme } from 'nativewind';

export function ThemeToggle() {
  const { colorScheme, setColorScheme, toggleColorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const handleToggle = () => {
    const nextTheme = isDark ? 'light' : 'dark';
    try {
      Appearance.setColorScheme(nextTheme);
    } catch (_e) {}
    try {
      nwColorScheme.set(nextTheme);
    } catch (_e) {}
    try {
      if (typeof setColorScheme === 'function') {
        setColorScheme(nextTheme);
      } else if (typeof toggleColorScheme === 'function') {
        toggleColorScheme();
      }
    } catch (_e) {}
  };

  return (
    <Pressable
      onPress={handleToggle}
      accessibilityRole="button"
      accessibilityLabel="Toggle Dark / Light Mode"
      className="w-11 h-11 rounded-full items-center justify-center bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-sm active:scale-95"
    >
      {isDark ? (
        <Sun size={20} color="#FF2D55" />
      ) : (
        <Moon size={20} color="#FF2D55" />
      )}
    </Pressable>
  );
}
