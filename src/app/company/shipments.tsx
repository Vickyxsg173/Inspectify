import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { BACKEND_URL } from '@/constants/api';

export default function ShipmentsScreen() {
  const { session } = useAuth();
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchShipments = async () => {
    if (!session) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${BACKEND_URL}/company/shipments`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setShipments(data);
      } else {
        const err = await res.json();
        Alert.alert('Error', err.detail || 'Could not load shipments.');
      }
    } catch (e: any) {
      Alert.alert('Connection Error', e.message || 'Failed to fetch shipments.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchShipments();
  }, [session]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchShipments();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'No Predicted Damage':
        return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' };
      case 'High Shipment Damage Risk':
        return { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30' };
      case 'Damage Detected':
        return { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' };
      default:
        return { bg: 'bg-zinc-800', text: 'text-zinc-400', border: 'border-zinc-700' };
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-zinc-950 items-center justify-center">
        <ActivityIndicator color="#FF2D55" size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-zinc-950">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF2D55" />}
      >
      {/* Header */}
      <View className="flex-row items-center justify-between mb-6">
        <TouchableOpacity
          onPress={() => router.back()}
          className="flex-row items-center bg-zinc-900 px-3 py-1.5 rounded-full border border-zinc-800"
        >
          <Ionicons name="arrow-back" size={16} color="#A1A1AA" />
          <Text className="text-zinc-400 text-xs ml-1 font-medium">Dashboard</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="bg-red-500 flex-row items-center px-4 py-2 rounded-xl"
          onPress={() => router.push('/company/new-shipment' as any)}
        >
          <Ionicons name="add" size={16} color="white" />
          <Text className="text-white font-bold text-xs ml-1">New Shipment</Text>
        </TouchableOpacity>
      </View>

      <Text className="text-2xl font-black text-white mb-1">Company Shipments</Text>
      <Text className="text-zinc-400 text-xs mb-6">Track batch risk evaluations and manage individual boxes.</Text>

      {shipments.length === 0 ? (
        <View className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 items-center justify-center my-6">
          <Ionicons name="cube-outline" size={44} color="#71717A" />
          <Text className="text-white font-bold text-base mt-3">No Shipments Found</Text>
          <Text className="text-zinc-400 text-xs text-center mt-1 mb-5">
            Log your first shipment route to begin assessing batch damage risks.
          </Text>
          <TouchableOpacity
            className="bg-red-500 px-5 py-2.5 rounded-xl"
            onPress={() => router.push('/company/new-shipment' as any)}
          >
            <Text className="text-white font-bold text-xs">Create First Shipment</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View className="gap-3">
          {shipments.map((s) => {
            const badge = getStatusBadge(s.status || 'draft');
            return (
              <TouchableOpacity
                key={s.id}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 active:bg-zinc-850"
                onPress={() => router.push(`/company/shipment-detail?id=${s.id}` as any)}
                activeOpacity={0.7}
              >
                <View className="flex-row justify-between items-start mb-2">
                  <View>
                    <Text className="text-white font-extrabold text-base tracking-tight">{s.id}</Text>
                    <Text className="text-zinc-400 text-xs mt-0.5">
                      Carrier: <Text className="text-zinc-300 font-semibold">{s.carrier || 'Unassigned'}</Text> · {s.transport_mode || 'Road'}
                    </Text>
                  </View>
                  <View className={`px-2.5 py-1 rounded-full border ${badge.bg} ${badge.border}`}>
                    <Text className={`text-[10px] font-bold uppercase tracking-wider ${badge.text}`}>
                      {s.status || 'draft'}
                    </Text>
                  </View>
                </View>

                <View className="flex-row items-center gap-2 mt-2 pt-2 border-t border-zinc-800/80">
                  <Ionicons name="location-outline" size={14} color="#FF2D55" />
                  <Text className="text-zinc-300 text-xs font-medium">
                    {s.origin} → {s.destination}
                  </Text>
                  <Text className="text-zinc-500 text-xs ml-auto">
                    {new Date(s.created_at).toLocaleDateString()}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </ScrollView>
  </SafeAreaView>
  );
}
