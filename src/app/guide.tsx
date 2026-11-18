import React, { useEffect } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { useRouter } from 'expo-router';

export default function GuideRedirect() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/');
    }, 80);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <View style={{ flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="small" color="#FF2D55" />
      <Text style={{ color: '#A1A1AA', marginTop: 12, fontSize: 13, fontWeight: '600' }}>
        Redirecting to Home...
      </Text>
    </View>
  );
}
