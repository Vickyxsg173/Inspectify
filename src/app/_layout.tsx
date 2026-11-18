import './global.css';

import { Stack } from 'expo-router';
import { AuthProvider } from '../contexts/AuthContext';
import { AnimatedSplashOverlay } from '@/components/animated-icon';

export default function RootLayout() {
  return (
    <AuthProvider>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        {/* Main tabs group */}
        <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />

        {/* Auth screens — slide up as modal */}
        <Stack.Screen
          name="auth/login"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="auth/register"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />

        {/* ML Prediction — push */}
        <Stack.Screen name="predict" />

        {/* Company screens — push */}
        <Stack.Screen name="company/dashboard" />
        <Stack.Screen name="company/shipments" />
        <Stack.Screen name="company/new-shipment" />
        <Stack.Screen name="company/shipment-detail" />
        <Stack.Screen name="company/analytics" />
        <Stack.Screen name="company/dispatch" />
      </Stack>
    </AuthProvider>
  );
}
