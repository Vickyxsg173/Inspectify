import './global.css';

import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { AnimatedSplashOverlay } from '@/components/animated-icon';

function RootNavigationStack() {
  const { session, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === 'auth';

    if (!session && !inAuthGroup) {
      // User is not signed in and trying to access app screens: redirect to login
      router.replace('/auth/login' as any);
    } else if (session && inAuthGroup) {
      // User is authenticated and on login/register screens: redirect to main app
      router.replace('/(tabs)');
    }
  }, [session, isLoading, segments]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#09090B', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#FF2D55" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      {/* Main tabs group */}
      <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />

      {/* Auth screens */}
      <Stack.Screen
        name="auth/login"
        options={{ animation: 'fade' }}
      />
      <Stack.Screen
        name="auth/register"
        options={{ animation: 'slide_from_right' }}
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
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AnimatedSplashOverlay />
      <RootNavigationStack />
    </AuthProvider>
  );
}
