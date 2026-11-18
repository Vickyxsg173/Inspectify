/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useTheme() {
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === 'dark' ? 'dark' : 'light';

  return Colors[theme];
}
