import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabaseClient';
import { BACKEND_URL } from '@/constants/api';

export default function ShipmentsScreen() {
  const { session, user, companyId, accountType } = useAuth();
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Guard: company feature only
  useEffect(() => {
    if (accountType === 'personal') {
      Alert.alert('Company Access Only', 'This feature is exclusively for enterprise accounts.');
      router.replace('/');
    }
  }, [accountType]);

  const fetchShipments = async () => {
    if (!session && !user) {
      setLoading(false);
      return;
    }

    try {
      // 1. Direct Supabase Query (zero-failure primary source)
      let resolvedCompanyId = companyId;
      if (!resolvedCompanyId && user?.id) {
        const { data: uProfile } = await supabase
          .from('users')
          .select('company_id')
          .eq('id', user.id)
          .single();
        if (uProfile?.company_id) {
          resolvedCompanyId = uProfile.company_id;
        }
      }

      let query = supabase.from('shipments').select('*').order('created_at', { ascending: false });
      if (resolvedCompanyId) {
        query = query.eq('company_id', resolvedCompanyId);
      }

      const { data: dbShipments, error: dbError } = await query;

      if (!dbError && dbShipments && dbShipments.length > 0) {
        setShipments(dbShipments);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // 2. Best-effort fallback to Backend API
      if (session?.access_token) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3500);

        const res = await fetch(`${BACKEND_URL}/company/shipments`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (res.ok) {
          const data = await res.json();
          setShipments(data);
          setLoading(false);
          setRefreshing(false);
          return;
        }
      }

      // If DB had 0 rows and no error
      if (!dbError && dbShipments) {
        setShipments(dbShipments);
      }
    } catch (e: any) {
      console.warn('Shipments fetch fallback error:', e.message);
      // Even if network fails, don't leave loading spinning
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchShipments();
  }, [session, user, companyId]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchShipments();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'No Predicted Damage':
      case 'Intact':
        return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' };
      case 'High Shipment Damage Risk':
      case 'Damaged':
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
            className="bg-red-500 flex-row items-center px-4 py-2 rounded-xl active:bg-red-600"
            onPress={() => router.push('/company/new-shipment' as any)}
          >
            <Ionicons name="add" size={16} color="white" />
            <Text className="text-white font-bold text-xs ml-1">New Shipment</Text>
          </TouchableOpacity>
        </View>

        <Text className="text-2xl font-black text-white mb-1">Active Company Shipments</Text>
        <Text className="text-zinc-400 text-xs mb-6">
          Track multi-box transit batches, evaluate structural packaging risks, and manage individual items.
        </Text>

        {shipments.length === 0 ? (
          <View className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 items-center justify-center my-6">
            <Ionicons name="cube-outline" size={44} color="#71717A" />
            <Text className="text-white font-bold text-base mt-3">No Active Shipments Found</Text>
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
                        Carrier: <Text className="text-zinc-300 font-semibold">{s.carrier || 'Unassigned'}</Text> ·{' '}
                        {s.transport_mode || 'Road'}
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
