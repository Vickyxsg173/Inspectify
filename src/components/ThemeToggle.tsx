import React from 'react';
import { Pressable } from 'react-native';
import { Sun, Moon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';

export function ThemeToggle() {
  const { colorScheme, toggleColorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Pressable
      onPress={toggleColorScheme}
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
