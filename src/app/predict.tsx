import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { BACKEND_URL } from '@/constants/api';

// ─── Option chip selector ─────────────────────────────────────────────────────
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

function OptionSelector({
  label,
  field,
  value,
  onChange,
}: {
  label: string;
  field: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const opts = FIELD_OPTIONS[field] || [];
  return (
    <View style={s.fieldWrap}>
      <Text style={s.fieldLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={s.chipRow}>
          {opts.map((opt) => {
            const sel = value === opt;
            return (
              <TouchableOpacity
                key={opt}
                onPress={() => onChange(opt)}
                style={[s.chip, sel ? s.chipSel : s.chipUnsel]}
              >
                <Text style={[s.chipText, sel ? s.chipTextSel : s.chipTextUnsel]}>
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
    <View style={[s.fieldWrap, { flex: 1 }]}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={s.numRow}>
        <TextInput
          style={s.numInput}
          placeholder={placeholder || '0'}
          placeholderTextColor="#71717A"
          value={value}
          onChangeText={onChange}
          keyboardType="numeric"
        />
        {unit ? <Text style={s.unit}>{unit}</Text> : null}
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function PredictScreen() {
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

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

  const set = (key: string) => (val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const handlePredict = async () => {
    setLoading(true);
    setResult(null);
    setError(null);

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

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const url = `${BACKEND_URL}/api/predictions/single-box`;
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) });
      const data = await res.json();

      if (!res.ok) {
        setError(data.detail || `Server error ${res.status}`);
        Alert.alert('Prediction Error', data.detail || `Server error ${res.status}`);
      } else {
        setResult(data);
      }
    } catch (e: any) {
      const msg = `Cannot reach backend at ${BACKEND_URL}. Make sure the server is running.\n\nError: ${e.message}`;
      setError(msg);
      Alert.alert('Network Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const condColor = (c: string) => (c === 'Damaged' ? '#EF4444' : '#10B981');

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        {/* ── Header ── */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={16} color="#A1A1AA" />
            <Text style={s.backText}>Back</Text>
          </TouchableOpacity>
          <View style={s.badge}>
            <Text style={s.badgeText}>CatBoost ML</Text>
          </View>
        </View>

        <Text style={s.title}>Package Damage{'\n'}Assessment</Text>
        <Text style={s.subtitle}>
          Evaluate 24 logistical & environmental risk variables with trained tabular ML classifiers.
        </Text>

        {/* ── Backend URL indicator ── */}
        <View style={s.urlBadge}>
          <Text style={s.urlText}>📡 Backend: {BACKEND_URL}</Text>
        </View>

        {/* ── Error banner ── */}
        {error ? (
          <View style={s.errorBanner}>
            <Text style={s.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* ── Result card ── */}
        {result ? (
          <View style={s.resultCard}>
            <View style={s.resultHeader}>
              <Text style={s.resultLabel}>Model Assessment</Text>
              <Text style={s.resultTime}>
                {new Date(result.timestamp).toLocaleTimeString()}
              </Text>
            </View>
            <Text style={s.classification}>{result.combined_classification}</Text>

            <View style={s.condRow}>
              <View style={s.condBox}>
                <Text style={s.condTitle}>Box Condition</Text>
                <Text style={[s.condValue, { color: condColor(result.box_condition) }]}>
                  {result.box_condition}
                </Text>
                <Text style={s.condProb}>
                  Risk: {(result.box_damage_probability * 100).toFixed(1)}%
                </Text>
              </View>
              <View style={s.condBox}>
                <Text style={s.condTitle}>Screen Condition</Text>
                <Text style={[s.condValue, { color: condColor(result.screen_condition) }]}>
                  {result.screen_condition}
                </Text>
                <Text style={s.condProb}>
                  Risk: {(result.screen_damage_probability * 100).toFixed(1)}%
                </Text>
              </View>
            </View>

            <View style={s.versionBox}>
              <Text style={s.versionText}>
                Model v{result.model_version} · Uncalibrated CatBoost output
              </Text>
            </View>
          </View>
        ) : null}

        {/* ── Section 1: Route & Logistics ── */}
        <Text style={s.sectionTitle}>1 · Route & Logistics</Text>
        <OptionSelector label="Transport Mode" field="transport_mode" value={form.transport_mode} onChange={set('transport_mode')} />
        <View style={s.row}>
          <NumericField label="Distance" value={form.distance_km} onChange={set('distance_km')} unit="km" />
          <View style={{ width: 10 }} />
          <OptionSelector label="Distance Method" field="distance_method" value={form.distance_method} onChange={set('distance_method')} />
        </View>
        <OptionSelector label="Carrier" field="carrier" value={form.carrier} onChange={set('carrier')} />

        {/* ── Section 2: Package ── */}
        <Text style={s.sectionTitle}>2 · Package Specifications</Text>
        <OptionSelector label="Package Type" field="package_type" value={form.package_type} onChange={set('package_type')} />
        <View style={s.row}>
          <NumericField label="Weight" value={form.package_weight_kg} onChange={set('package_weight_kg')} unit="kg" />
          <View style={{ width: 10 }} />
          <NumericField label="Length" value={form.package_length_cm} onChange={set('package_length_cm')} unit="cm" />
        </View>
        <View style={s.row}>
          <NumericField label="Width" value={form.package_width_cm} onChange={set('package_width_cm')} unit="cm" />
          <View style={{ width: 10 }} />
          <NumericField label="Height" value={form.package_height_cm} onChange={set('package_height_cm')} unit="cm" />
        </View>
        <OptionSelector label="Packaging Material" field="packaging_material" value={form.packaging_material} onChange={set('packaging_material')} />
        <OptionSelector label="Cushioning Type" field="cushioning_type" value={form.cushioning_type} onChange={set('cushioning_type')} />
        <OptionSelector label="Handling Conditions" field="handling_conditions" value={form.handling_conditions} onChange={set('handling_conditions')} />
        <OptionSelector label="Fragile Handling" field="fragile_handling" value={form.fragile_handling} onChange={set('fragile_handling')} />
        <View style={s.row}>
          <NumericField label="Transit Hours" value={form.transit_hours} onChange={set('transit_hours')} unit="hrs" />
          <View style={{ width: 10 }} />
          <NumericField label="Exposure Hours" value={form.exposure_hours} onChange={set('exposure_hours')} unit="hrs" />
        </View>
        <NumericField label="Handling Touchpoints" value={form.handling_events} onChange={set('handling_events')} placeholder="e.g. 4" />

        {/* ── Section 3: Environment ── */}
        <Text style={s.sectionTitle}>3 · Environmental Variables</Text>
        <View style={s.row}>
          <NumericField label="Temp Mean" value={form.temperature_mean} onChange={set('temperature_mean')} unit="°C" />
          <View style={{ width: 10 }} />
          <NumericField label="Temp Max" value={form.temperature_max} onChange={set('temperature_max')} unit="°C" />
          <View style={{ width: 10 }} />
          <NumericField label="Temp Min" value={form.temperature_min} onChange={set('temperature_min')} unit="°C" />
        </View>
        <View style={s.row}>
          <NumericField label="Humidity" value={form.humidity_mean} onChange={set('humidity_mean')} unit="%" />
          <View style={{ width: 10 }} />
          <NumericField label="Precipitation" value={form.precipitation_mm} onChange={set('precipitation_mm')} unit="mm" />
          <View style={{ width: 10 }} />
          <NumericField label="Max Wind" value={form.wind_speed_max} onChange={set('wind_speed_max')} unit="km/h" />
        </View>
        <OptionSelector label="Weather Data Available" field="weather_data_available" value={form.weather_data_available} onChange={set('weather_data_available')} />
        <OptionSelector label="Station Coverage" field="weather_station_coverage" value={form.weather_station_coverage} onChange={set('weather_station_coverage')} />

        {/* ── Submit ── */}
        <TouchableOpacity
          style={[s.submitBtn, loading && s.submitDisabled]}
          onPress={handlePredict}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={s.submitText}>Run Tabular Damage Assessment</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles (plain RN — no NativeWind class parsing needed) ──────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#09090B' },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 80 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  backBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#18181B', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: '#27272A', gap: 4 },
  backText: { color: '#A1A1AA', fontSize: 12, fontWeight: '500' },
  badge: { backgroundColor: 'rgba(255,45,85,0.1)', borderWidth: 1, borderColor: 'rgba(255,45,85,0.3)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { color: '#FF2D55', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },

  title: { fontSize: 26, fontWeight: '900', color: '#FFFFFF', marginBottom: 4 },
  subtitle: { fontSize: 12, color: '#71717A', marginBottom: 12 },

  urlBadge: { backgroundColor: '#18181B', borderWidth: 1, borderColor: '#27272A', borderRadius: 10, padding: 8, marginBottom: 12 },
  urlText: { color: '#52525B', fontSize: 11, fontFamily: 'monospace' },

  errorBanner: { backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', borderRadius: 12, padding: 12, marginBottom: 16 },
  errorText: { color: '#FCA5A5', fontSize: 12, lineHeight: 18 },

  resultCard: { backgroundColor: '#18181B', borderWidth: 1, borderColor: '#27272A', borderRadius: 16, padding: 16, marginBottom: 24 },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  resultLabel: { fontSize: 11, fontWeight: '700', color: '#71717A', textTransform: 'uppercase', letterSpacing: 1 },
  resultTime: { fontSize: 11, color: '#52525B' },
  classification: { fontSize: 20, fontWeight: '900', color: '#FFFFFF', marginBottom: 12 },
  condRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  condBox: { flex: 1, backgroundColor: '#09090B', borderWidth: 1, borderColor: '#27272A', borderRadius: 12, padding: 12 },
  condTitle: { color: '#71717A', fontSize: 11, marginBottom: 4, fontWeight: '500' },
  condValue: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  condProb: { color: '#52525B', fontSize: 11 },
  versionBox: { backgroundColor: '#09090B', borderWidth: 1, borderColor: '#27272A', borderRadius: 10, padding: 10 },
  versionText: { color: '#52525B', fontSize: 11 },

  sectionTitle: { color: '#FF2D55', fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginTop: 16, marginBottom: 12 },

  fieldWrap: { marginBottom: 12 },
  fieldLabel: { color: '#A1A1AA', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  chipRow: { flexDirection: 'row', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  chipSel: { backgroundColor: '#FF2D55', borderColor: '#FF2D55' },
  chipUnsel: { backgroundColor: '#18181B', borderColor: '#27272A' },
  chipText: { fontSize: 12, fontWeight: '600' },
  chipTextSel: { color: '#FFFFFF' },
  chipTextUnsel: { color: '#71717A' },

  numRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#18181B', borderWidth: 1, borderColor: '#27272A', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  numInput: { flex: 1, color: '#FFFFFF', fontSize: 14 },
  unit: { color: '#52525B', fontSize: 11, fontWeight: '700', marginLeft: 6 },

  row: { flexDirection: 'row', marginBottom: 0 },

  submitBtn: { backgroundColor: '#FF2D55', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 24, shadowColor: '#FF2D55', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
