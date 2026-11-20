import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabaseClient';
import { BACKEND_URL } from '@/constants/api';
import { LocationSearchInput } from '../../components/LocationSearchInput';

const TRANSPORT_MODES = ['Road', 'Air', 'Sea', 'Rail'];
const CARRIERS = ['FedEx', 'DHL', 'UPS', 'BlueDart', 'Delhivery', 'Other'];

export default function NewShipmentScreen() {
  const { session, user, companyId, accountType } = useAuth();
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [carrier, setCarrier] = useState('DHL');
  const [transportMode, setTransportMode] = useState('Road');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  // Guard: company feature only
  React.useEffect(() => {
    if (accountType === 'personal') {
      Alert.alert('Company Access Only', 'This feature is exclusively for enterprise accounts.');
      router.replace('/');
    }
  }, [accountType]);

  const handleCreate = async () => {
    if (!origin.trim() || !destination.trim()) {
      Alert.alert('Missing Info', 'Origin and destination addresses are required.');
      return;
    }
    setLoading(true);

    try {
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

      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const shipmentId = `SHP-${dateStr}-${suffix}`;

      const shipmentRecord = {
        id: shipmentId,
        company_id: resolvedCompanyId || null,
        created_by: user?.id || null,
        origin: origin.trim(),
        destination: destination.trim(),
        carrier,
        transport_mode: transportMode,
        notes: notes.trim() || null,
        status: 'draft',
      };

      const { error: dbError } = await supabase.from('shipments').insert(shipmentRecord);

      if (dbError) {
        console.warn('Supabase shipment insert error:', dbError);
        if (session?.access_token) {
          const res = await fetch(`${BACKEND_URL}/company/shipments`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              origin: origin.trim(),
              destination: destination.trim(),
              carrier,
              transport_mode: transportMode,
              notes: notes.trim() || undefined,
            }),
          });
          if (!res.ok) {
            const e = await res.json().catch(() => ({}));
            throw new Error(e.detail || dbError.message || 'Could not create shipment.');
          }
        } else {
          throw new Error(dbError.message || 'Database insert failed');
        }
      }

      Alert.alert('Shipment Created', `Shipment batch ${shipmentId} generated successfully.`, [
        { text: 'View Shipments', onPress: () => router.replace('/company/shipments' as any) },
      ]);
    } catch (e: any) {
      Alert.alert('Error Creating Shipment', e.message || 'Failed to save shipment.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-zinc-950">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <TouchableOpacity
            onPress={() => router.back()}
            className="flex-row items-center mb-6 bg-zinc-900 self-start px-3 py-1.5 rounded-full border border-zinc-800"
          >
            <Ionicons name="arrow-back" size={16} color="#A1A1AA" />
            <Text className="text-zinc-400 text-xs ml-1 font-medium">Cancel</Text>
          </TouchableOpacity>

          <Text className="text-2xl font-black text-white mb-1">Create New Shipment</Text>
          <Text className="text-zinc-400 text-xs mb-6">Enter departure origin, destination, and transit mode.</Text>

          <View className="gap-4">
            {/* Live Google Maps style location search inputs */}
            <LocationSearchInput
              label="Origin Hub / Address *"
              value={origin}
              onChangeText={setOrigin}
              onSelect={(name) => setOrigin(name)}
              placeholder="Search origin city, terminal, or address…"
            />

            <LocationSearchInput
              label="Destination Hub / Address *"
              value={destination}
              onChangeText={setDestination}
              onSelect={(name) => setDestination(name)}
              placeholder="Search destination city, terminal, or address…"
            />

            <View>
              <Text className="text-zinc-300 text-xs font-semibold mb-1.5 uppercase tracking-wider">
                Transport Mode
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-2">
                  {TRANSPORT_MODES.map((m) => {
                    const sel = transportMode === m;
                    return (
                      <TouchableOpacity
                        key={m}
                        onPress={() => setTransportMode(m)}
                        className={`px-4 py-2 rounded-xl border ${
                          sel ? 'bg-red-500 border-red-500' : 'bg-zinc-900 border-zinc-800'
                        }`}
                      >
                        <Text className={`text-xs font-bold ${sel ? 'text-white' : 'text-zinc-400'}`}>{m}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>

            <View>
              <Text className="text-zinc-300 text-xs font-semibold mb-1.5 uppercase tracking-wider">
                Logistics Carrier
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-2">
                  {CARRIERS.map((c) => {
                    const sel = carrier === c;
                    return (
                      <TouchableOpacity
                        key={c}
                        onPress={() => setCarrier(c)}
                        className={`px-4 py-2 rounded-xl border ${
                          sel ? 'bg-red-500 border-red-500' : 'bg-zinc-900 border-zinc-800'
                        }`}
                      >
                        <Text className={`text-xs font-bold ${sel ? 'text-white' : 'text-zinc-400'}`}>{c}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>

            <View>
              <Text className="text-zinc-300 text-xs font-semibold mb-1 uppercase tracking-wider">Shipment Notes</Text>
              <TextInput
                className="bg-zinc-900 border border-zinc-800 text-white rounded-xl px-4 py-3.5 text-sm"
                placeholder="Optional notes or instructions..."
                placeholderTextColor="#71717A"
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
              />
            </View>

            <TouchableOpacity
              className="bg-red-500 active:bg-red-600 rounded-xl py-4 items-center mt-4 shadow-lg shadow-red-500/20"
              onPress={handleCreate}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-bold text-base">Generate Shipment</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
