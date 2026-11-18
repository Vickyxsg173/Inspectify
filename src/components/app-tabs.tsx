import { AntDesign, Entypo, Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { Platform } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

export default function AppTabs() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { accountType } = useAuth();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: isDark ? '#000000' : '#FFFFFF',
          borderTopColor: isDark ? '#1C1C20' : '#EAEAEA',
          borderTopWidth: 1,
          elevation: 0,
          shadowOpacity: isDark ? 0 : 0.05,
          shadowOffset: { width: 0, height: -2 },
          shadowRadius: 6,
          height: Platform.OS === 'ios' ? 88 : 68,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#FF2D55',
        tabBarInactiveTintColor: isDark ? '#71717A' : '#A1A1AA',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 0.2,
        },
      }}
    >
      {/* 1. Home Tab */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Entypo name="home" color={String(color)} size={size} />
          ),
        }}
      />

      {/* 2. Unified Image Defect QC */}
      <Tabs.Screen
        name="image-inspect"
        options={{
          title: 'Image QC',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="scan-outline" color={String(color)} size={size + 1} />
          ),
        }}
      />

      {/* 3. Unified Live AR Feed & Video Inspection */}
      <Tabs.Screen
        name="live-video"
        options={{
          title: 'Live & Video',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="cctv" color={String(color)} size={size + 2} />
          ),
        }}
      />

      {/* 4. AI Claims Support */}
      <Tabs.Screen
        name="support-beta"
        options={{
          title: 'AI Support',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="robot-happy-outline" color={String(color)} size={size + 2} />
          ),
        }}
      />

      {/* 5. Settings */}
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings" color={String(color)} size={size} />
          ),
        }}
      />

      {/* Hidden Screens: Legacy & Sub-flows */}
      <Tabs.Screen name="guide" options={{ href: null }} />
      <Tabs.Screen name="screen-scratch" options={{ href: null }} />
      <Tabs.Screen name="live-stream" options={{ href: null }} />
      <Tabs.Screen name="video-inspection" options={{ href: null }} />

      {/* Hidden Screens: Auth & ML & Company Routes */}
      <Tabs.Screen name="auth/login" options={{ href: null }} />
      <Tabs.Screen name="auth/register" options={{ href: null }} />
      <Tabs.Screen name="predict" options={{ href: null }} />
      <Tabs.Screen name="company/dashboard" options={{ href: null }} />
      <Tabs.Screen name="company/shipments" options={{ href: null }} />
      <Tabs.Screen name="company/new-shipment" options={{ href: null }} />
      <Tabs.Screen name="company/shipment-detail" options={{ href: null }} />
      <Tabs.Screen name="company/analytics" options={{ href: null }} />
      <Tabs.Screen name="company/dispatch" options={{ href: null }} />
    </Tabs>
  );
}
