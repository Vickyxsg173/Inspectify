import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, TextInput } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { BACKEND_URL } from '@/constants/api';

export default function ShipmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [shipment, setShipment] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [predicting, setPredicting] = useState(false);
  const [showAddBox, setShowAddBox] = useState(false);
  const [boxLabel, setBoxLabel] = useState('');
  const [packageType, setPackageType] = useState('Box');
  const [weightKg, setWeightKg] = useState('5.0');
  const [addingBox, setAddingBox] = useState(false);

  const fetchData = async () => {
    if (!session || !id) return;
    try {
      const [sRes, sumRes] = await Promise.all([
        fetch(`${BACKEND_URL}/company/shipments/${id}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
        fetch(`${BACKEND_URL}/company/shipments/${id}/summary`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
      ]);
      if (sRes.ok) setShipment(await sRes.json());
      if (sumRes.ok) setSummary(await sumRes.json());
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not load shipment details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [session, id]);

  const handleAddBox = async () => {
    if (!boxLabel.trim()) {
      Alert.alert('Required', 'Please enter a box label or barcode.');
      return;
    }
    setAddingBox(true);
    try {
      const res = await fetch(`${BACKEND_URL}/company/shipments/${id}/boxes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          box_label: boxLabel.trim(),
          package_type: packageType,
          package_weight_kg: parseFloat(weightKg) || 0,
        }),
      });
      if (res.ok) {
        setBoxLabel('');
        setShowAddBox(false);
        fetchData();
      } else {
        const err = await res.json();
        Alert.alert('Error', err.detail || 'Could not add box.');
      }
    } catch (e: any) {
      Alert.alert('Network Error', e.message);
    } finally {
      setAddingBox(false);
    }
  };

  const runPredictAll = async () => {
    setPredicting(true);
    try {
      const res = await fetch(`${BACKEND_URL}/company/shipments/${id}/predict-all`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
        Alert.alert('Evaluation Complete', `Shipment Status: ${data.shipment_status}`);
        fetchData();
      } else {
        const err = await res.json();
        Alert.alert('Evaluation Failed', err.detail || 'Could not evaluate shipment.');
      }
    } catch (e: any) {
      Alert.alert('Network Error', e.message);
    } finally {
      setPredicting(false);
    }
  };

  const getStatusColor = (status: string) => {
    if (!status) return '#A1A1AA';
    if (status.includes('No Predicted')) return '#10B981';
    if (status.includes('High')) return '#EF4444';
    return '#F59E0B';
  };

  if (loading) {
    return (
      <View className="flex-1 bg-zinc-950 items-center justify-center">
        <ActivityIndicator color="#FF2D55" size="large" />
      </View>
    );
  }

  const currentSummary = summary?.summary || summary;
  const boxes = shipment?.shipment_boxes || [];

  return (
    <ScrollView className="flex-1 bg-zinc-950" contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
      {/* Header */}
      <View className="flex-row items-center justify-between mb-4">
        <TouchableOpacity
          onPress={() => router.back()}
          className="flex-row items-center bg-zinc-900 px-3 py-1.5 rounded-full border border-zinc-800"
        >
          <Ionicons name="arrow-back" size={16} color="#A1A1AA" />
          <Text className="text-zinc-400 text-xs ml-1 font-medium">Shipments</Text>
        </TouchableOpacity>

        <View className="bg-zinc-900 px-3 py-1 rounded-full border border-zinc-800">
          <Text className="text-zinc-400 text-xs font-mono">{shipment?.id}</Text>
        </View>
      </View>

      <Text className="text-2xl font-black text-white mb-1">
        {shipment?.origin} → {shipment?.destination}
      </Text>
      <Text className="text-zinc-400 text-xs mb-6">
        Carrier: <Text className="text-zinc-200 font-semibold">{shipment?.carrier || 'DHL'}</Text> · Transit: {shipment?.transport_mode || 'Road'}
      </Text>

      {/* Aggregate Assessment Card */}
      {currentSummary && (
        <View className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-6 shadow-xl">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Shipment Damage Status</Text>
            <View
              className="px-2.5 py-0.5 rounded-full"
              style={{ backgroundColor: `${getStatusColor(currentSummary.shipment_status || shipment?.status)}20` }}
            >
              <Text
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: getStatusColor(currentSummary.shipment_status || shipment?.status) }}
              >
                {currentSummary.shipment_status || shipment?.status || 'draft'}
              </Text>
            </View>
          </View>

          {currentSummary.total_boxes !== undefined && (
            <View className="mt-3 pt-3 border-t border-zinc-800">
              <View className="flex-row justify-between mb-2">
                <Text className="text-zinc-400 text-xs">Total Monitored Boxes</Text>
                <Text className="text-white font-bold text-xs">{currentSummary.total_boxes}</Text>
              </View>
              <View className="flex-row justify-between mb-2">
                <Text className="text-zinc-400 text-xs">Damaged Count</Text>
                <Text className="text-rose-400 font-bold text-xs">{currentSummary.damaged_count}</Text>
              </View>
              <View className="flex-row justify-between mb-2">
                <Text className="text-zinc-400 text-xs">Intact Count</Text>
                <Text className="text-emerald-400 font-bold text-xs">{currentSummary.intact_count}</Text>
              </View>
              <View className="flex-row justify-between mb-1">
                <Text className="text-zinc-400 text-xs">P(At least 1 box damaged)</Text>
                <Text className="text-amber-400 font-bold text-xs">
                  {(currentSummary.p_any_damaged * 100).toFixed(1)}%
                </Text>
              </View>
              <Text className="text-zinc-600 text-[10px] italic">
                * Based on independent binomial failure probability assumption across package units.
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Package Boxes Section */}
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-base font-bold text-white">Packages in Shipment ({boxes.length})</Text>
        <TouchableOpacity
          className="bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-xl flex-row items-center"
          onPress={() => setShowAddBox(!showAddBox)}
        >
          <Ionicons name={showAddBox ? 'close' : 'add'} size={14} color="#FF2D55" />
          <Text className="text-white text-xs font-bold ml-1">{showAddBox ? 'Cancel' : 'Add Box'}</Text>
        </TouchableOpacity>
      </View>

      {/* Inline Add Box Form */}
      {showAddBox && (
        <View className="bg-zinc-900 border border-red-500/30 rounded-2xl p-4 mb-4">
          <Text className="text-white font-bold text-sm mb-3">Add Box to Shipment</Text>
          <TextInput
            className="bg-zinc-950 border border-zinc-800 text-white rounded-xl px-4 py-2.5 text-xs mb-3"
            placeholder="Box Label / Tracking ID (e.g. BOX-001)"
            placeholderTextColor="#71717A"
            value={boxLabel}
            onChangeText={setBoxLabel}
          />
          <View className="flex-row gap-3 mb-3">
            <TextInput
              className="flex-1 bg-zinc-950 border border-zinc-800 text-white rounded-xl px-4 py-2.5 text-xs"
              placeholder="Package Type (Box/Crate)"
              placeholderTextColor="#71717A"
              value={packageType}
              onChangeText={setPackageType}
            />
            <TextInput
              className="flex-1 bg-zinc-950 border border-zinc-800 text-white rounded-xl px-4 py-2.5 text-xs"
              placeholder="Weight (kg)"
              placeholderTextColor="#71717A"
              value={weightKg}
              onChangeText={setWeightKg}
              keyboardType="numeric"
            />
          </View>
          <TouchableOpacity
            className="bg-red-500 py-3 rounded-xl items-center"
            onPress={handleAddBox}
            disabled={addingBox}
          >
            {addingBox ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-bold text-xs">Save Box to Batch</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Box List */}
      {boxes.length === 0 ? (
        <View className="bg-zinc-900/50 border border-dashed border-zinc-800 rounded-2xl p-6 items-center my-2">
          <Text className="text-zinc-500 text-xs">No boxes logged in this shipment yet.</Text>
          <Text className="text-zinc-600 text-[11px] mt-0.5">Click "Add Box" above to add package units.</Text>
        </View>
      ) : (
        <View className="gap-2.5">
          {boxes.map((box: any) => (
            <View key={box.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5">
              <View className="flex-row justify-between items-center">
                <Text className="text-white font-bold text-sm">
                  {box.box_label || `Unit #${box.id.slice(0, 6)}`}
                </Text>
                {box.box_condition ? (
                  <View
                    className={`px-2 py-0.5 rounded-full ${
                      box.box_condition === 'Damaged' ? 'bg-red-500/20' : 'bg-emerald-500/20'
                    }`}
                  >
                    <Text
                      className={`text-[10px] font-bold ${
                        box.box_condition === 'Damaged' ? 'text-red-400' : 'text-emerald-400'
                      }`}
                    >
                      Box: {box.box_condition}
                    </Text>
                  </View>
                ) : (
                  <Text className="text-zinc-500 text-[10px] font-semibold uppercase">Pending Eval</Text>
                )}
              </View>
              <Text className="text-zinc-500 text-xs mt-1">
                {box.package_type || 'Standard'} · {box.package_weight_kg ? `${box.package_weight_kg} kg` : 'Weight unspec'}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Run Aggregate Predictions Action */}
      <TouchableOpacity
        className="bg-red-500 active:bg-red-600 rounded-xl py-4 items-center mt-6 shadow-lg shadow-red-500/20"
        onPress={runPredictAll}
        disabled={predicting}
      >
        {predicting ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-white font-bold text-sm">Run Risk Assessment on All Boxes</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

