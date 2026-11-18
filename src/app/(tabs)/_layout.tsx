import { AntDesign, Entypo, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { Platform } from 'react-native';

export default function TabsLayout() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

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
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Entypo name="home" color={String(color)} size={size} />,
        }}
      />
      <Tabs.Screen
        name="image-inspect"
        options={{
          title: 'Image QC',
          tabBarIcon: ({ color, size }) => <Ionicons name="scan-outline" color={String(color)} size={size + 1} />,
        }}
      />
      <Tabs.Screen
        name="live-video"
        options={{
          title: 'Live & Video',
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="cctv" color={String(color)} size={size + 2} />,
        }}
      />
      <Tabs.Screen
        name="support-beta"
        options={{
          title: 'AI Support',
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="robot-happy-outline" color={String(color)} size={size + 2} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Ionicons name="settings" color={String(color)} size={size} />,
        }}
      />

      {/* Hidden legacy sub-screens */}
      <Tabs.Screen name="guide" options={{ href: null }} />
      <Tabs.Screen name="screen-scratch" options={{ href: null }} />
      <Tabs.Screen name="live-stream" options={{ href: null }} />
      <Tabs.Screen name="video-inspection" options={{ href: null }} />
    </Tabs>
  );
}
