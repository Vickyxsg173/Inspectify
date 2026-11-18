import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BACKEND_URL } from '@/constants/api';

const FIELD_OPTIONS: Record<string, string[]> = {
  transport_mode: ['Road', 'Air', 'Sea', 'Rail'],
  distance_method: ['GPS', 'Estimated', 'Declared'],
  carrier: ['FedEx', 'DHL', 'UPS', 'BlueDart', 'Delhivery', 'Other'],
  package_type: ['Box', 'Pallet', 'Bag', 'Crate', 'Tube'],
  packaging_material: ['Cardboard', 'Plastic', 'Wood', 'Metal', 'Foam'],
  cushioning_type: ['Bubble Wrap', 'Foam', 'Air Pillows', 'Paper', 'None'],
  handling_conditions: ['Fragile', 'Standard', 'Heavy', 'Frozen'],
  fragile_handling: ['Yes', 'No'],
  weather_data_available: ['Yes', 'No'],
  weather_station_coverage: ['Full', 'Partial', 'None'],
};

function OptionSelector({ label, field, value, onChange }: { label: string; field: string; value: string; onChange: (v: string) => void }) {
  const opts = FIELD_OPTIONS[field] || [];
  return (
    <View className="mb-4">
      <Text className="text-zinc-300 text-xs font-semibold mb-1.5 uppercase tracking-wider">{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-2">
          {opts.map((opt) => {
            const isSelected = value === opt;
            return (
              <TouchableOpacity
                key={opt}
                onPress={() => onChange(opt)}
                className={`px-3.5 py-2 rounded-xl border ${
                  isSelected
                    ? 'bg-red-500 border-red-500'
                    : 'bg-zinc-900 border-zinc-800'
                }`}
              >
                <Text className={`text-xs font-semibold ${isSelected ? 'text-white' : 'text-zinc-400'}`}>
                  {opt}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

function NumericField({
  label,
  value,
  onChange,
  placeholder,
  unit,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  unit?: string;
}) {
  return (
    <View className="mb-4 flex-1">
      <Text className="text-zinc-300 text-xs font-semibold mb-1.5 uppercase tracking-wider">{label}</Text>
      <View className="flex-row items-center bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
        <TextInput
          className="flex-1 text-white text-sm"
          placeholder={placeholder || '0'}
          placeholderTextColor="#71717A"
          value={value}
          onChangeText={onChange}
          keyboardType="numeric"
        />
        {unit && <Text className="text-zinc-500 text-xs font-semibold ml-2">{unit}</Text>}
      </View>
    </View>
  );
}

export default function PredictScreen() {
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const [form, setForm] = useState({
    transport_mode: 'Road',
    distance_km: '350',
    distance_method: 'GPS',
    carrier: 'DHL',
    package_type: 'Box',
    package_weight_kg: '4.5',
    package_length_cm: '30',
    package_width_cm: '25',
    package_height_cm: '15',
    packaging_material: 'Cardboard',
    cushioning_type: 'Bubble Wrap',
    handling_conditions: 'Standard',
    fragile_handling: 'Yes',
    transit_hours: '18',
    exposure_hours: '4',
    handling_events: '3',
    temperature_mean: '22',
    temperature_max: '28',
    temperature_min: '16',
    humidity_mean: '55',
    precipitation_mm: '2.5',
    wind_speed_max: '14',
    weather_data_available: 'Yes',
    weather_station_coverage: 'Full',
  });

  const setVal = (key: string) => (val: string) => setForm((prev) => ({ ...prev, [key]: val }));

  const handlePredict = async () => {
    setLoading(true);
    setResult(null);

    try {
      const payload = {
        transport_mode: form.transport_mode,
        distance_km: parseFloat(form.distance_km) || 0,
        distance_method: form.distance_method,
        carrier: form.carrier,
        package_type: form.package_type,
        package_weight_kg: parseFloat(form.package_weight_kg) || 0,
        package_length_cm: parseFloat(form.package_length_cm) || 0,
        package_width_cm: parseFloat(form.package_width_cm) || 0,
        package_height_cm: parseFloat(form.package_height_cm) || 0,
        packaging_material: form.packaging_material,
        cushioning_type: form.cushioning_type,
        handling_conditions: form.handling_conditions,
        fragile_handling: form.fragile_handling,
        transit_hours: parseFloat(form.transit_hours) || 0,
        exposure_hours: parseFloat(form.exposure_hours) || 0,
        handling_events: parseInt(form.handling_events) || 0,
        temperature_mean: parseFloat(form.temperature_mean) || 0,
        temperature_max: parseFloat(form.temperature_max) || 0,
        temperature_min: parseFloat(form.temperature_min) || 0,
        humidity_mean: parseFloat(form.humidity_mean) || 0,
        precipitation_mm: parseFloat(form.precipitation_mm) || 0,
        wind_speed_max: parseFloat(form.wind_speed_max) || 0,
        weather_data_available: form.weather_data_available,
        weather_station_coverage: form.weather_station_coverage,
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const res = await fetch(`${BACKEND_URL}/api/predictions/single-box`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        Alert.alert('Prediction Error', data.detail || 'Could not evaluate model.');
      } else {
        setResult(data);
      }
    } catch (e: any) {
      Alert.alert('Network Error', e.message || 'Failed to connect to backend server.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (condition: string) => (condition === 'Damaged' ? '#EF4444' : '#10B981');

  return (
    <SafeAreaView className="flex-1 bg-zinc-950">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
        {/* Header */}
      <View className="flex-row items-center justify-between mb-4">
        <TouchableOpacity
          onPress={() => router.back()}
          className="flex-row items-center bg-zinc-900 px-3 py-1.5 rounded-full border border-zinc-800"
        >
          <Ionicons name="arrow-back" size={16} color="#A1A1AA" />
          <Text className="text-zinc-400 text-xs ml-1 font-medium">Back</Text>
        </TouchableOpacity>
        <View className="bg-red-500/10 border border-red-500/30 px-3 py-1 rounded-full">
          <Text className="text-red-500 text-xs font-bold uppercase tracking-wider">CatBoost ML</Text>
        </View>
      </View>

      <Text className="text-2xl font-black text-white mb-1">Package Damage Assessment</Text>
      <Text className="text-zinc-400 text-xs mb-6">
        Evaluate 24 logistical & environmental risk variables with trained tabular ML classifiers.
      </Text>

      {/* Prediction Result Display */}
      {result && (
        <View className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-8 shadow-xl">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Model Assessment</Text>
            <Text className="text-xs text-zinc-500">{new Date(result.timestamp).toLocaleTimeString()}</Text>
          </View>

          <Text className="text-xl font-extrabold text-white mb-3">{result.combined_classification}</Text>

          <View className="flex-row gap-3 mb-4">
            <View className="flex-1 bg-zinc-950/80 p-3.5 rounded-xl border border-zinc-800">
              <Text className="text-zinc-400 text-xs mb-1 font-medium">Box Condition</Text>
              <Text className="text-base font-bold" style={{ color: getStatusColor(result.box_condition) }}>
                {result.box_condition}
              </Text>
              <Text className="text-zinc-500 text-xs mt-1">
                Risk: {(result.box_damage_probability * 100).toFixed(1)}%
              </Text>
            </View>

            <View className="flex-1 bg-zinc-950/80 p-3.5 rounded-xl border border-zinc-800">
              <Text className="text-zinc-400 text-xs mb-1 font-medium">Screen Condition</Text>
              <Text className="text-base font-bold" style={{ color: getStatusColor(result.screen_condition) }}>
                {result.screen_condition}
              </Text>
              <Text className="text-zinc-500 text-xs mt-1">
                Risk: {(result.screen_damage_probability * 100).toFixed(1)}%
              </Text>
            </View>
          </View>

          <View className="bg-zinc-950 p-3 rounded-xl border border-zinc-800/80">
            <Text className="text-zinc-400 text-xs">
              <Text className="font-bold text-zinc-300">Model Version:</Text> {result.model_version} · Raw probability output (uncalibrated).
            </Text>
          </View>
        </View>
      )}

      {/* Section 1: Route & Logistics */}
      <View className="mb-6">
        <View className="flex-row items-center gap-2 mb-3">
          <Ionicons name="navigate-outline" size={16} color="#FF2D55" />
          <Text className="text-sm font-bold text-white uppercase tracking-wider">1. Route & Logistics</Text>
        </View>
        <OptionSelector label="Transport Mode" field="transport_mode" value={form.transport_mode} onChange={setVal('transport_mode')} />
        <View className="flex-row gap-3">
          <NumericField label="Distance" value={form.distance_km} onChange={setVal('distance_km')} unit="km" />
          <OptionSelector label="Distance Method" field="distance_method" value={form.distance_method} onChange={setVal('distance_method')} />
        </View>
        <OptionSelector label="Carrier" field="carrier" value={form.carrier} onChange={setVal('carrier')} />
      </View>

      {/* Section 2: Package Specs & Handling */}
      <View className="mb-6">
        <View className="flex-row items-center gap-2 mb-3">
          <Ionicons name="cube-outline" size={16} color="#FF2D55" />
          <Text className="text-sm font-bold text-white uppercase tracking-wider">2. Package Specifications</Text>
        </View>
        <OptionSelector label="Package Type" field="package_type" value={form.package_type} onChange={setVal('package_type')} />
        <View className="flex-row gap-3">
          <NumericField label="Weight" value={form.package_weight_kg} onChange={setVal('package_weight_kg')} unit="kg" />
          <NumericField label="Length" value={form.package_length_cm} onChange={setVal('package_length_cm')} unit="cm" />
        </View>
        <View className="flex-row gap-3">
          <NumericField label="Width" value={form.package_width_cm} onChange={setVal('package_width_cm')} unit="cm" />
          <NumericField label="Height" value={form.package_height_cm} onChange={setVal('package_height_cm')} unit="cm" />
        </View>
        <OptionSelector label="Packaging Material" field="packaging_material" value={form.packaging_material} onChange={setVal('packaging_material')} />
        <OptionSelector label="Cushioning Type" field="cushioning_type" value={form.cushioning_type} onChange={setVal('cushioning_type')} />
        <OptionSelector label="Handling Conditions" field="handling_conditions" value={form.handling_conditions} onChange={setVal('handling_conditions')} />
        <OptionSelector label="Fragile Handling Declared" field="fragile_handling" value={form.fragile_handling} onChange={setVal('fragile_handling')} />
        <View className="flex-row gap-3">
          <NumericField label="Transit Hours" value={form.transit_hours} onChange={setVal('transit_hours')} unit="hrs" />
          <NumericField label="Exposure Hours" value={form.exposure_hours} onChange={setVal('exposure_hours')} unit="hrs" />
        </View>
        <NumericField label="Handling Touchpoints / Events" value={form.handling_events} onChange={setVal('handling_events')} placeholder="e.g. 4" />
      </View>

      {/* Section 3: Weather & Environment */}
      <View className="mb-6">
        <View className="flex-row items-center gap-2 mb-3">
          <Ionicons name="cloudy-night-outline" size={16} color="#FF2D55" />
          <Text className="text-sm font-bold text-white uppercase tracking-wider">3. Environmental Variables</Text>
        </View>
        <View className="flex-row gap-3">
          <NumericField label="Temp Mean" value={form.temperature_mean} onChange={setVal('temperature_mean')} unit="°C" />
          <NumericField label="Temp Max" value={form.temperature_max} onChange={setVal('temperature_max')} unit="°C" />
          <NumericField label="Temp Min" value={form.temperature_min} onChange={setVal('temperature_min')} unit="°C" />
        </View>
        <View className="flex-row gap-3">
          <NumericField label="Humidity Mean" value={form.humidity_mean} onChange={setVal('humidity_mean')} unit="%" />
          <NumericField label="Precipitation" value={form.precipitation_mm} onChange={setVal('precipitation_mm')} unit="mm" />
          <NumericField label="Max Wind" value={form.wind_speed_max} onChange={setVal('wind_speed_max')} unit="km/h" />
        </View>
        <OptionSelector label="Weather Data Available" field="weather_data_available" value={form.weather_data_available} onChange={setVal('weather_data_available')} />
        <OptionSelector label="Station Coverage" field="weather_station_coverage" value={form.weather_station_coverage} onChange={setVal('weather_station_coverage')} />
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        className="bg-red-500 active:bg-red-600 rounded-xl py-4 items-center mb-10 shadow-lg shadow-red-500/25"
        onPress={handlePredict}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-white font-bold text-base">Run Tabular Damage Assessment</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  </SafeAreaView>
  );
}
