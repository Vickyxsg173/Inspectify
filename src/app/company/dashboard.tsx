import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';

export default function CompanyDashboard() {
  const { user, companyName, signOut } = useAuth();

  const navigationCards = [
    {
      title: 'Active Shipments',
      subtitle: 'Manage multi-box batches & damage risks',
      icon: <Ionicons name="cube" size={24} color="#FF2D55" />,
      route: '/company/shipments',
      badge: 'Core Logistics',
    },
    {
      title: 'Single-Box ML Evaluator',
      subtitle: 'Predict box & screen damage on 24 variables',
      icon: <MaterialCommunityIcons name="calculator-variant" size={24} color="#3B82F6" />,
      route: '/predict',
      badge: 'CatBoost',
    },
    {
      title: 'Shipment Analytics',
      subtitle: 'Fleet damage trends & condition breakdowns',
      icon: <Ionicons name="bar-chart" size={24} color="#10B981" />,
      route: '/company/analytics',
      badge: 'Insights',
    },
    {
      title: 'Dispatch Window Optimizer',
      subtitle: 'Find safest departure dates using weather forecast',
      icon: <FontAwesome5 name="route" size={22} color="#F59E0B" />,
      route: '/company/dispatch',
      badge: 'Optimization',
    },
  ];

  return (
    <SafeAreaView className="flex-1 bg-zinc-950">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
        {/* Header */}
      <View className="flex-row items-center justify-between mb-6">
        <View>
          <View className="flex-row items-center gap-2 mb-1">
            <View className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <Text className="text-red-500 font-bold uppercase tracking-widest text-xs">Company Portal</Text>
          </View>
          <Text className="text-2xl font-black text-white">{companyName || 'Enterprise Dashboard'}</Text>
          <Text className="text-zinc-400 text-xs mt-0.5">{user?.email}</Text>
        </View>

        <TouchableOpacity
          onPress={() => signOut().then(() => router.replace('/'))}
          className="bg-zinc-900 border border-zinc-800 p-2.5 rounded-xl"
        >
          <Ionicons name="log-out-outline" size={18} color="#A1A1AA" />
        </TouchableOpacity>
      </View>

      {/* Quick Action Banner */}
      <TouchableOpacity
        className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 mb-6 flex-row items-center justify-between"
        onPress={() => router.push('/company/new-shipment' as any)}
      >
        <View className="flex-row items-center gap-3">
          <View className="w-10 h-10 rounded-xl bg-red-500 items-center justify-center">
            <Ionicons name="add" size={24} color="white" />
          </View>
          <View>
            <Text className="text-white font-bold text-sm">Create New Shipment</Text>
            <Text className="text-zinc-400 text-xs">Log route, carrier, and add boxes</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#FF2D55" />
      </TouchableOpacity>

      {/* Feature Grid */}
      <Text className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-3">Enterprise Operations</Text>
      <View className="gap-3 mb-8">
        {navigationCards.map((card) => (
          <TouchableOpacity
            key={card.title}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex-row items-center justify-between active:bg-zinc-800"
            onPress={() => router.push(card.route as any)}
            activeOpacity={0.7}
          >
            <View className="flex-row items-center gap-3.5 flex-1 pr-2">
              <View className="w-12 h-12 rounded-xl bg-zinc-950 items-center justify-center border border-zinc-800">
                {card.icon}
              </View>
              <View className="flex-1">
                <View className="flex-row items-center gap-2 mb-0.5">
                  <Text className="text-white font-bold text-base">{card.title}</Text>
                </View>
                <Text className="text-zinc-400 text-xs" numberOfLines={1}>{card.subtitle}</Text>
              </View>
            </View>
            <View className="items-end">
              <Text className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider mb-1">{card.badge}</Text>
              <Ionicons name="chevron-forward" size={16} color="#71717A" />
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Return to Core CV Scanners */}
      <View className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-4">
        <Text className="text-zinc-300 font-bold text-sm mb-1">Looking for Image & Video QC?</Text>
        <Text className="text-zinc-500 text-xs mb-3">
          Use the bottom navigation tabs to access YOLO camera scanning, screen micro-scratch detection, and live video analysis.
        </Text>
        <TouchableOpacity
          onPress={() => router.push('/image-inspect')}
          className="bg-zinc-800 py-2.5 rounded-xl items-center"
        >
          <Text className="text-white font-semibold text-xs">Open Image QC Camera</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  </SafeAreaView>
  );
}
