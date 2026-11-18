import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { BACKEND_URL } from '@/constants/api';

export default function AnalyticsScreen() {
  const { session } = useAuth();
  const [overview, setOverview] = useState<any>(null);
  const [routes, setRoutes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAnalytics = async () => {
    if (!session) {
      setLoading(false);
      return;
    }
    try {
      const [oRes, rRes] = await Promise.all([
        fetch(`${BACKEND_URL}/company/analytics/overview`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
        fetch(`${BACKEND_URL}/company/analytics/route-analysis`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
      ]);
      if (oRes.ok) setOverview(await oRes.json());
      if (rRes.ok) {
        const rData = await rRes.json();
        setRoutes(rData.data || []);
      }
    } catch (e) {
      console.warn('Analytics fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [session]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAnalytics();
  };

  if (loading) {
    return (
      <View className="flex-1 bg-zinc-950 items-center justify-center">
        <ActivityIndicator color="#FF2D55" size="large" />
      </View>
    );
  }

  const damagedPct =
    overview && overview.total_predictions > 0
      ? ((overview.total_damaged_predictions / overview.total_predictions) * 100).toFixed(1)
      : '0.0';

  return (
    <ScrollView
      className="flex-1 bg-zinc-950"
      contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF2D55" />}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between mb-4">
        <TouchableOpacity
          onPress={() => router.back()}
          className="flex-row items-center bg-zinc-900 px-3 py-1.5 rounded-full border border-zinc-800"
        >
          <Ionicons name="arrow-back" size={16} color="#A1A1AA" />
          <Text className="text-zinc-400 text-xs ml-1 font-medium">Dashboard</Text>
        </TouchableOpacity>
        <Text className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Fleet Intelligence</Text>
      </View>

      <Text className="text-2xl font-black text-white mb-1">Logistics Damage Analytics</Text>
      <Text className="text-zinc-400 text-xs mb-6">Aggregated performance and failure metrics across company shipments.</Text>

      {/* KPI Cards */}
      <View className="flex-row gap-3 mb-3">
        <View className="flex-1 bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <Text className="text-zinc-400 text-xs font-medium">Total Shipments</Text>
          <Text className="text-2xl font-black text-white mt-1">{overview?.total_shipments ?? 0}</Text>
          <Text className="text-zinc-500 text-[10px] mt-1">Logged active batches</Text>
        </View>

        <View className="flex-1 bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <Text className="text-zinc-400 text-xs font-medium">ML Predictions</Text>
          <Text className="text-2xl font-black text-white mt-1">{overview?.total_predictions ?? 0}</Text>
          <Text className="text-zinc-500 text-[10px] mt-1">Total package runs</Text>
        </View>
      </View>

      <View className="flex-row gap-3 mb-6">
        <View className="flex-1 bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <Text className="text-zinc-400 text-xs font-medium">Damage Incident Rate</Text>
          <Text className="text-2xl font-black text-rose-400 mt-1">{damagedPct}%</Text>
          <Text className="text-zinc-500 text-[10px] mt-1">{overview?.total_damaged_predictions ?? 0} packages flagged</Text>
        </View>

        <View className="flex-1 bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <Text className="text-zinc-400 text-xs font-medium">Intact Rate</Text>
          <Text className="text-2xl font-black text-emerald-400 mt-1">
            {overview && overview.total_predictions > 0 ? (100 - parseFloat(damagedPct)).toFixed(1) : '100.0'}%
          </Text>
          <Text className="text-zinc-500 text-[10px] mt-1">{overview?.total_intact_predictions ?? 0} confirmed safe</Text>
        </View>
      </View>

      {/* Route Risk Monitoring */}
      <Text className="text-sm font-bold text-white mb-3">Recent Route Logs ({routes.length})</Text>
      {routes.length === 0 ? (
        <View className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 items-center">
          <Text className="text-zinc-500 text-xs">No route damage logs recorded yet.</Text>
        </View>
      ) : (
        <View className="gap-2.5">
          {routes.slice(0, 10).map((r, idx) => (
            <View key={idx} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 flex-row justify-between items-center">
              <View>
                <Text className="text-white font-bold text-xs">{r.origin} → {r.destination}</Text>
                <Text className="text-zinc-500 text-[10px] mt-0.5">Route Batch</Text>
              </View>
              <View className="bg-zinc-800 px-2.5 py-1 rounded-full">
                <Text className="text-zinc-300 text-[10px] font-semibold">{r.status || 'Active'}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

