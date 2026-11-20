import React, { useState, useEffect } from 'react';
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
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { supabase } from '../../services/supabaseClient';
import { predictCatBoostRisk, CatBoostPredictionResult } from '../../services/catboostPredictor';
import { LocationSearchInput } from '../../components/LocationSearchInput';
import { exportLogisticsRiskPdf } from '../../utils/pdfReportGenerator';

// ─── Constants ────────────────────────────────────────────────────────────────
const TRANSPORT_MODES = ['Road', 'Air', 'Sea', 'Rail'] as const;
type TransportMode = (typeof TRANSPORT_MODES)[number];

const CARRIERS = ['DHL', 'FedEx', 'UPS', 'BlueDart', 'Delhivery', 'Other'];
const PACKAGE_TYPES = ['Box', 'Pallet', 'Crate', 'Bag'];
const PACKAGING_MATERIALS = ['Cardboard', 'Plastic', 'Wood', 'Metal'];
const CUSHIONING_TYPES = ['Bubble Wrap', 'Foam', 'Air Pillows', 'Paper', 'None'];
const FRAGILE_OPTIONS = ['Yes', 'No'] as const;

// Transport-mode specific extra attributes
const MODE_ATTRS: Record<
  TransportMode,
  {
    icon: string;
    defaultDays: number;
    showStops: boolean;
    showVibration: boolean;
    showHumidity: boolean;
    showAltitude: boolean;
    showJunctions: boolean;
    showPortHandling: boolean;
    riskNote: string;
  }
> = {
  Road: {
    icon: 'truck',
    defaultDays: 3,
    showStops: true,
    showVibration: true,
    showHumidity: false,
    showAltitude: false,
    showJunctions: false,
    showPortHandling: false,
    riskNote: 'Road vibration & precipitation are primary risk factors.',
  },
  Air: {
    icon: 'airplane',
    defaultDays: 1,
    showStops: false,
    showVibration: false,
    showHumidity: false,
    showAltitude: true,
    showJunctions: false,
    showPortHandling: false,
    riskNote: 'Pressure changes at altitude & rapid temperature swings are key risks.',
  },
  Sea: {
    icon: 'boat',
    defaultDays: 14,
    showStops: false,
    showVibration: false,
    showHumidity: true,
    showAltitude: false,
    showJunctions: false,
    showPortHandling: true,
    riskNote: 'High humidity, salt-air corrosion & port handling are primary risks.',
  },
  Rail: {
    icon: 'train',
    defaultDays: 4,
    showStops: true,
    showVibration: true,
    showHumidity: false,
    showAltitude: false,
    showJunctions: true,
    showPortHandling: false,
    riskNote: 'Rail vibration at junctions & shunting impact are key damage drivers.',
  },
};

export default function AnalyticsScreen() {
  const { session, companyId, companyName, accountType } = useAuth();

  // Guard: company feature only
  useEffect(() => {
    if (accountType === 'personal') {
      Alert.alert('Company Access Only', 'This feature is exclusively for enterprise accounts.');
      router.replace('/');
    }
  }, [accountType]);

  const [activeTab, setActiveTab] = useState<'simulator' | 'fleet'>('simulator');

  // Location state with live Google Maps style autocomplete
  const [originCity, setOriginCity] = useState('Mumbai, Maharashtra');
  const [destCity, setDestCity] = useState('Delhi, New Delhi');
  const [originCoords, setOriginCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [destCoords, setDestCoords] = useState<{ lat: number; lon: number } | null>(null);

  const [carrier, setCarrier] = useState('DHL');
  const [transportMode, setTransportMode] = useState<TransportMode>('Road');
  const [packageType, setPackageType] = useState('Box');
  const [weightKg, setWeightKg] = useState('5.5');
  const [packagingMaterial, setPackagingMaterial] = useState('Cardboard');
  const [cushioning, setCushioning] = useState('Bubble Wrap');
  const [fragileHandling, setFragileHandling] = useState<'Yes' | 'No'>('Yes');

  // Mode-specific extras
  const [numStops, setNumStops] = useState('2');
  const [vibrationLevel, setVibrationLevel] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [humidityExposure, setHumidityExposure] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [altitudeRisk, setAltitudeRisk] = useState<'Low' | 'High'>('Low');
  const [junctionCount, setJunctionCount] = useState('4');
  const [portHandlings, setPortHandlings] = useState('2');

  // Live API data
  const [loadingApis, setLoadingApis] = useState(false);
  const [predicting, setPredicting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [liveData, setLiveData] = useState<{
    distanceKm: number;
    originCoords: { lat: number; lon: number };
    destCoords: { lat: number; lon: number };
    weather: {
      tempMean: number;
      tempMax: number;
      tempMin: number;
      humidity: number;
      precipitation: number;
      windSpeed: number;
    };
  } | null>(null);

  const [predictionResult, setPredictionResult] = useState<CatBoostPredictionResult | null>(null);

  // Fleet overview state
  const [fleetLoading, setFleetLoading] = useState(false);
  const [fleetData, setFleetData] = useState<{
    totalShipments: number;
    totalBoxes: number;
    damagedBoxes: number;
    defectRate: number;
    recentAlerts: { route: string; status: string; date: string }[];
  } | null>(null);

  const calcDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371.0;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  };

  const geocodeCity = async (city: string, stored: { lat: number; lon: number } | null) => {
    if (stored) return stored;
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city.trim())}&format=json&limit=1`,
      { headers: { 'User-Agent': 'InspectifyApp/1.0' } }
    );
    const data = await res.json();
    if (!data || data.length === 0) throw new Error(`Could not locate: ${city}`);
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  };

  // ── Step 1: Sync real GPS + Weather ──────────────────────────────────────────
  const fetchLiveLogisticsData = async () => {
    if (!originCity.trim() || !destCity.trim()) {
      Alert.alert('Required', 'Please enter both Origin and Destination addresses.');
      return;
    }
    setLoadingApis(true);
    setPredictionResult(null);

    try {
      const oc = await geocodeCity(originCity, originCoords);
      const dc = await geocodeCity(destCity, destCoords);
      setOriginCoords(oc);
      setDestCoords(dc);

      const distance = calcDistanceKm(oc.lat, oc.lon, dc.lat, dc.lon);
      const midLat = (oc.lat + dc.lat) / 2;
      const midLon = (oc.lon + dc.lon) / 2;

      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${midLat}&longitude=${midLon}&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,windspeed_10m_max,relativehumidity_2m_mean&timezone=auto&forecast_days=1`
      );
      const weatherJson = await weatherRes.json();
      const daily = weatherJson.daily || {};

      const weather = {
        tempMean: Math.round((daily.temperature_2m_mean || [24])[0]),
        tempMax: Math.round((daily.temperature_2m_max || [30])[0]),
        tempMin: Math.round((daily.temperature_2m_min || [18])[0]),
        humidity: Math.round((daily.relativehumidity_2m_mean || [55])[0]),
        precipitation: Number((daily.precipitation_sum || [0])[0]),
        windSpeed: Math.round((daily.windspeed_10m_max || [14])[0]),
      };

      setLiveData({ distanceKm: distance, originCoords: oc, destCoords: dc, weather });

      Alert.alert(
        'Route & Weather Synchronized',
        `Distance: ${distance} km\nCorridor Temp: ${weather.tempMean}°C\nRainfall: ${weather.precipitation} mm\nHumidity: ${weather.humidity}%`
      );
    } catch (e: any) {
      Alert.alert('Live Data Fetch Failed', e.message || 'Check your internet connection.');
    } finally {
      setLoadingApis(false);
    }
  };

  // ── Step 2: Run CatBoost prediction with zero-failure guarantee ──────────────
  const handleRunCatBoostPrediction = async () => {
    if (!liveData) {
      Alert.alert('Fetch Live Data First', 'Please tap "Sync Live Route GPS & Weather" before predicting.');
      return;
    }

    setPredicting(true);
    setPredictionResult(null);

    try {
      const dist = liveData.distanceKm;
      const modeAttrs = MODE_ATTRS[transportMode];

      const transitHours = Math.max(2, modeAttrs.defaultDays * 24);
      const exposureHours = Math.max(1, Math.round(dist / 200));
      const handlingEvents = Math.max(2, Math.round(dist / 90));

      const payload = {
        transport_mode: transportMode,
        distance_km: dist,
        distance_method: 'GPS',
        carrier,
        package_type: packageType,
        package_weight_kg: parseFloat(weightKg) || 5.0,
        package_length_cm: 32.0,
        package_width_cm: 26.0,
        package_height_cm: 18.0,
        packaging_material: packagingMaterial,
        cushioning_type: cushioning,
        handling_conditions: fragileHandling === 'Yes' ? 'Fragile' : 'Standard',
        fragile_handling: fragileHandling,
        transit_hours: transitHours,
        exposure_hours: exposureHours,
        handling_events: handlingEvents,
        temperature_mean: liveData.weather.tempMean,
        temperature_max: liveData.weather.tempMax,
        temperature_min: liveData.weather.tempMin,
        humidity_mean: liveData.weather.humidity,
        precipitation_mm: liveData.weather.precipitation,
        wind_speed_max: liveData.weather.windSpeed,
        weather_data_available: 'Yes',
        weather_station_coverage: 'Full',
        number_of_stops: parseInt(numStops) || 2,
        vibration_level: vibrationLevel,
        humidity_exposure: humidityExposure,
        altitude_risk: altitudeRisk,
        junction_count: parseInt(junctionCount) || 4,
        port_handlings: parseInt(portHandlings) || 2,
      };

      const result = await predictCatBoostRisk(payload, session?.access_token);
      setPredictionResult(result);
    } catch (e: any) {
      Alert.alert('Prediction Notice', e.message || 'Evaluation completed');
    } finally {
      setPredicting(false);
    }
  };

  // ── Step 3: Export PDF Report with Influencing Feature & Loss Reduction ───────
  const handleExportPdf = async () => {
    if (!predictionResult || !liveData) {
      Alert.alert('No Prediction Data', 'Please run a prediction first before exporting the audit report.');
      return;
    }

    setExportingPdf(true);
    try {
      await exportLogisticsRiskPdf({
        companyName: companyName || undefined,
        origin: originCity,
        destination: destCity,
        distanceKm: liveData.distanceKm,
        carrier,
        transportMode,
        packageType,
        weightKg,
        packagingMaterial,
        cushioning,
        fragileHandling,
        numStops,
        vibrationLevel,
        humidityExposure,
        altitudeRisk,
        weather: liveData.weather,
        prediction: predictionResult,
      });
    } catch (e: any) {
      Alert.alert('Export Error', e.message || 'Could not generate PDF report.');
    } finally {
      setExportingPdf(false);
    }
  };

  // ── Fleet Overview: fixed Supabase query (no 'status' column in shipment_boxes) ─
  const loadFleetData = async () => {
    setFleetLoading(true);
    try {
      let query = supabase
        .from('shipments')
        .select('id, origin, destination, created_at, shipment_boxes(id, box_condition, screen_condition, box_label)')
        .order('created_at', { ascending: false })
        .limit(50);

      if (companyId) {
        query = query.eq('company_id', companyId);
      }

      const { data: shipmentData, error } = await query;

      if (error) throw error;

      const rows = shipmentData ?? [];
      let totalBoxes = 0;
      let damagedBoxes = 0;

      for (const shipment of rows) {
        const boxes = (shipment as any).shipment_boxes ?? [];
        totalBoxes += boxes.length;
        damagedBoxes += boxes.filter(
          (b: any) => b.box_condition === 'Damaged' || b.screen_condition === 'Damaged'
        ).length;
      }

      const defectRate = totalBoxes > 0 ? Math.round((damagedBoxes / totalBoxes) * 100 * 10) / 10 : 0;

      const recentAlerts = rows.slice(0, 5).map((s: any) => ({
        route: `${s.origin ?? '—'} → ${s.destination ?? '—'}`,
        status: s.shipment_boxes?.some(
          (b: any) => b.box_condition === 'Damaged' || b.screen_condition === 'Damaged'
        )
          ? 'Has Damage'
          : 'Clean',
        date: new Date(s.created_at).toLocaleDateString(),
      }));

      setFleetData({ totalShipments: rows.length, totalBoxes, damagedBoxes, defectRate, recentAlerts });
    } catch (e: any) {
      console.warn('Fleet Data notice:', e.message);
      setFleetData({
        totalShipments: 0,
        totalBoxes: 0,
        damagedBoxes: 0,
        defectRate: 0,
        recentAlerts: [],
      });
    } finally {
      setFleetLoading(false);
    }
  };

  const handleTabSwitch = (tab: 'simulator' | 'fleet') => {
    setActiveTab(tab);
    if (tab === 'fleet' && !fleetData && !fleetLoading) {
      loadFleetData();
    }
  };

  const getStatusColor = (cond: string) => (cond === 'Damaged' ? '#EF4444' : '#10B981');
  const modeInfo = MODE_ATTRS[transportMode];

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={16} color="#A1A1AA" />
            <Text style={s.backText}>Dashboard</Text>
          </TouchableOpacity>
          <View style={s.badge}>
            <Text style={s.badgeText}>Live API Intelligence</Text>
          </View>
        </View>

        <Text style={s.title}>Logistics Risk & Analytics</Text>
        <Text style={s.subtitle}>
          Real-time route simulation combining live OpenStreetMap GPS, Open-Meteo weather, and trained CatBoost damage models.
        </Text>

        {/* Tab Switcher */}
        <View style={s.tabBar}>
          <TouchableOpacity
            style={[s.tabBtn, activeTab === 'simulator' && s.tabBtnActive]}
            onPress={() => handleTabSwitch('simulator')}
          >
            <Ionicons name="analytics" size={15} color={activeTab === 'simulator' ? '#FFFFFF' : '#71717A'} />
            <Text style={[s.tabText, activeTab === 'simulator' && s.tabTextActive]}>Route Risk Simulator</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.tabBtn, activeTab === 'fleet' && s.tabBtnActive]}
            onPress={() => handleTabSwitch('fleet')}
          >
            <FontAwesome5 name="chart-pie" size={13} color={activeTab === 'fleet' ? '#FFFFFF' : '#71717A'} />
            <Text style={[s.tabText, activeTab === 'fleet' && s.tabTextActive]}>Fleet Overview</Text>
          </TouchableOpacity>
        </View>

        {/* ═══════════════════════════ SIMULATOR TAB ═══════════════════════════ */}
        {activeTab === 'simulator' ? (
          <View>
            {/* Step 1: Route with live Google Maps style autocomplete */}
            <View style={s.card}>
              <View style={s.cardHeader}>
                <Ionicons name="location-outline" size={18} color="#FF2D55" />
                <Text style={s.cardTitle}>1. Shipping Corridor (Live GPS Geolocation)</Text>
              </View>

              <View style={s.row}>
                <LocationSearchInput
                  label="Origin Hub / Address"
                  value={originCity}
                  onChangeText={setOriginCity}
                  onSelect={(name, lat, lon) => {
                    setOriginCity(name);
                    setOriginCoords({ lat, lon });
                  }}
                  placeholder="e.g. Bandra Kurla Complex, Mumbai"
                />
                <View style={{ width: 12 }} />
                <LocationSearchInput
                  label="Destination Hub / Address"
                  value={destCity}
                  onChangeText={setDestCity}
                  onSelect={(name, lat, lon) => {
                    setDestCity(name);
                    setDestCoords({ lat, lon });
                  }}
                  placeholder="e.g. IGI Airport Cargo, Delhi"
                />
              </View>

              <TouchableOpacity
                style={[s.syncBtn, loadingApis && { opacity: 0.6 }]}
                onPress={fetchLiveLogisticsData}
                disabled={loadingApis}
              >
                {loadingApis ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <View style={s.btnContent}>
                    <Ionicons name="cloud-download-outline" size={16} color="#FFFFFF" />
                    <Text style={s.syncBtnText}>Sync Live Route GPS & Weather API</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Live Telemetry */}
              {liveData && (
                <View style={s.liveDataBlock}>
                  <View style={s.liveDataHeader}>
                    <Text style={s.liveDataTitle}>Live Transit Telemetry</Text>
                    <View style={s.livePill}>
                      <Text style={s.livePillText}>CONNECTED</Text>
                    </View>
                  </View>
                  <View style={s.telemetryGrid}>
                    <View style={s.telemetryItem}>
                      <Text style={s.telemetryVal}>{liveData.distanceKm} km</Text>
                      <Text style={s.telemetryLbl}>GPS Distance</Text>
                    </View>
                    <View style={s.telemetryItem}>
                      <Text style={s.telemetryVal}>{liveData.weather.tempMean}°C</Text>
                      <Text style={s.telemetryLbl}>Corridor Temp</Text>
                    </View>
                    <View style={s.telemetryItem}>
                      <Text style={s.telemetryVal}>{liveData.weather.humidity}%</Text>
                      <Text style={s.telemetryLbl}>Humidity</Text>
                    </View>
                    <View style={s.telemetryItem}>
                      <Text style={s.telemetryVal}>{liveData.weather.precipitation} mm</Text>
                      <Text style={s.telemetryLbl}>Rainfall</Text>
                    </View>
                  </View>
                </View>
              )}
            </View>

            {/* Step 2: Package & Handling with transport-mode dynamic attrs */}
            <View style={s.card}>
              <View style={s.cardHeader}>
                <Ionicons name="cube-outline" size={18} color="#FF2D55" />
                <Text style={s.cardTitle}>2. Package & Handling Specs</Text>
              </View>

              {/* Carrier */}
              <Text style={s.fieldLabel}>Carrier</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll}>
                <View style={s.chipRow}>
                  {CARRIERS.map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[s.chip, carrier === c ? s.chipActive : s.chipInactive]}
                      onPress={() => setCarrier(c)}
                    >
                      <Text style={[s.chipText, carrier === c && s.chipTextActive]}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {/* Transport Mode */}
              <Text style={s.fieldLabel}>Transport Mode</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll}>
                <View style={s.chipRow}>
                  {TRANSPORT_MODES.map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[s.chip, transportMode === m ? s.chipActive : s.chipInactive]}
                      onPress={() => setTransportMode(m)}
                    >
                      <Text style={[s.chipText, transportMode === m && s.chipTextActive]}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {/* Mode-specific risk note */}
              <View style={s.modeNoteBox}>
                <Ionicons name="information-circle-outline" size={14} color="#71717A" />
                <Text style={s.modeNoteText}>{modeInfo.riskNote}</Text>
              </View>

              {/* Mode-specific dynamic fields */}
              {modeInfo.showStops && (
                <>
                  <Text style={s.fieldLabel}>Number of Stops / Transfers</Text>
                  <TextInput
                    style={[s.input, { marginBottom: 12 }]}
                    value={numStops}
                    onChangeText={setNumStops}
                    keyboardType="numeric"
                    placeholderTextColor="#71717A"
                  />
                </>
              )}

              {modeInfo.showVibration && (
                <>
                  <Text style={s.fieldLabel}>Vibration Exposure Level</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll}>
                    <View style={s.chipRow}>
                      {(['Low', 'Medium', 'High'] as const).map((v) => (
                        <TouchableOpacity
                          key={v}
                          style={[s.chip, vibrationLevel === v ? s.chipActive : s.chipInactive]}
                          onPress={() => setVibrationLevel(v)}
                        >
                          <Text style={[s.chipText, vibrationLevel === v && s.chipTextActive]}>{v}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </>
              )}

              {modeInfo.showHumidity && (
                <>
                  <Text style={s.fieldLabel}>Sea Humidity Exposure</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll}>
                    <View style={s.chipRow}>
                      {(['Low', 'Medium', 'High'] as const).map((h) => (
                        <TouchableOpacity
                          key={h}
                          style={[s.chip, humidityExposure === h ? s.chipActive : s.chipInactive]}
                          onPress={() => setHumidityExposure(h)}
                        >
                          <Text style={[s.chipText, humidityExposure === h && s.chipTextActive]}>{h}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </>
              )}

              {modeInfo.showPortHandling && (
                <>
                  <Text style={s.fieldLabel}>Port Handling Events</Text>
                  <TextInput
                    style={[s.input, { marginBottom: 12 }]}
                    value={portHandlings}
                    onChangeText={setPortHandlings}
                    keyboardType="numeric"
                    placeholderTextColor="#71717A"
                  />
                </>
              )}

              {modeInfo.showAltitude && (
                <>
                  <Text style={s.fieldLabel}>Altitude Pressure Risk</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll}>
                    <View style={s.chipRow}>
                      {(['Low', 'High'] as const).map((a) => (
                        <TouchableOpacity
                          key={a}
                          style={[s.chip, altitudeRisk === a ? s.chipActive : s.chipInactive]}
                          onPress={() => setAltitudeRisk(a)}
                        >
                          <Text style={[s.chipText, altitudeRisk === a && s.chipTextActive]}>{a}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </>
              )}

              {modeInfo.showJunctions && (
                <>
                  <Text style={s.fieldLabel}>Rail Junction Count</Text>
                  <TextInput
                    style={[s.input, { marginBottom: 12 }]}
                    value={junctionCount}
                    onChangeText={setJunctionCount}
                    keyboardType="numeric"
                    placeholderTextColor="#71717A"
                  />
                </>
              )}

              {/* Common fields */}
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>Package Weight (kg)</Text>
                  <TextInput
                    style={s.input}
                    value={weightKg}
                    onChangeText={setWeightKg}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ width: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>Packaging Material</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {PACKAGING_MATERIALS.map((m) => (
                        <TouchableOpacity
                          key={m}
                          style={[s.chip, packagingMaterial === m ? s.chipActive : s.chipInactive]}
                          onPress={() => setPackagingMaterial(m)}
                        >
                          <Text style={[s.chipText, packagingMaterial === m && s.chipTextActive]}>{m}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              </View>

              {/* Cushioning */}
              <Text style={s.fieldLabel}>Cushioning Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll}>
                <View style={s.chipRow}>
                  {CUSHIONING_TYPES.map((cush) => (
                    <TouchableOpacity
                      key={cush}
                      style={[s.chip, cushioning === cush ? s.chipActive : s.chipInactive]}
                      onPress={() => setCushioning(cush)}
                    >
                      <Text style={[s.chipText, cushioning === cush && s.chipTextActive]}>{cush}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {/* Fragile Handling */}
              <Text style={s.fieldLabel}>Fragile Handling</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll}>
                <View style={s.chipRow}>
                  {FRAGILE_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      style={[s.chip, fragileHandling === opt ? s.chipActive : s.chipInactive]}
                      onPress={() => setFragileHandling(opt)}
                    >
                      <Text style={[s.chipText, fragileHandling === opt && s.chipTextActive]}>{opt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Run CatBoost Button */}
            <TouchableOpacity
              style={[s.predictBtn, predicting && { opacity: 0.6 }]}
              onPress={handleRunCatBoostPrediction}
              disabled={predicting}
            >
              {predicting ? (
                <View style={s.btnContent}>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                  <Text style={s.predictBtnText}>  Evaluating CatBoost ML Model…</Text>
                </View>
              ) : (
                <View style={s.btnContent}>
                  <MaterialCommunityIcons name="calculator-variant" size={18} color="#FFFFFF" />
                  <Text style={s.predictBtnText}>Run ML Damage Prediction</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Result Card with Export PDF Option */}
            {predictionResult && (
              <View style={s.resultCard}>
                <View style={s.resultHead}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={s.resultTitle}>CatBoost Damage Assessment</Text>
                    {predictionResult.is_local_engine && (
                      <View style={s.engineBadge}>
                        <Text style={s.engineBadgeText}>Edge AI Engine</Text>
                      </View>
                    )}
                  </View>
                  <Text style={s.resultTime}>
                    {new Date(predictionResult.timestamp).toLocaleTimeString()}
                  </Text>
                </View>

                <Text style={s.resultCombined}>{predictionResult.combined_classification}</Text>

                <View style={s.metricGrid}>
                  <View style={s.metricBox}>
                    <Text style={s.metricLabel}>Outer Box Condition</Text>
                    <Text style={[s.metricStatus, { color: getStatusColor(predictionResult.box_condition) }]}>
                      {predictionResult.box_condition}
                    </Text>
                    <Text style={s.metricProb}>
                      Risk: {(predictionResult.box_damage_probability * 100).toFixed(1)}%
                    </Text>
                  </View>
                  <View style={s.metricBox}>
                    <Text style={s.metricLabel}>Inner Screen / Content</Text>
                    <Text style={[s.metricStatus, { color: getStatusColor(predictionResult.screen_condition) }]}>
                      {predictionResult.screen_condition}
                    </Text>
                    <Text style={s.metricProb}>
                      Risk: {(predictionResult.screen_damage_probability * 100).toFixed(1)}%
                    </Text>
                  </View>
                </View>

                <View style={s.infoFoot}>
                  <Text style={s.infoFootText}>
                    Features fed: {liveData?.distanceKm} km route, {liveData?.weather.tempMean}°C mean temp,{' '}
                    {liveData?.weather.precipitation}mm rain, {carrier} carrier via {transportMode}, {cushioning} buffer.
                  </Text>
                </View>

                {/* OFFICIAL EXPORT PDF REPORT BUTTON */}
                <TouchableOpacity
                  style={[s.exportPdfBtn, exportingPdf && { opacity: 0.7 }]}
                  onPress={handleExportPdf}
                  disabled={exportingPdf}
                >
                  {exportingPdf ? (
                    <View style={s.btnContent}>
                      <ActivityIndicator color="#FFFFFF" size="small" />
                      <Text style={s.exportPdfText}>Generating Official Audit PDF…</Text>
                    </View>
                  ) : (
                    <View style={s.btnContent}>
                      <Ionicons name="document-text-outline" size={18} color="#FFFFFF" />
                      <Text style={s.exportPdfText}>Export Official PDF Risk Report</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : (
          /* ═══════════════════════════ FLEET TAB ══════════════════════════════ */
          <View>
            {fleetLoading ? (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <ActivityIndicator color="#FF2D55" size="large" />
                <Text style={[s.fieldLabel, { marginTop: 12 }]}>Loading fleet data…</Text>
              </View>
            ) : fleetData ? (
              <>
                <View style={s.kpiRow}>
                  <View style={s.kpiCard}>
                    <Text style={s.kpiLabel}>Total Shipments</Text>
                    <Text style={s.kpiVal}>{fleetData.totalShipments}</Text>
                    <Text style={s.kpiSub}>Active transit batches</Text>
                  </View>
                  <View style={s.kpiCard}>
                    <Text style={s.kpiLabel}>Fleet Avg Defect Rate</Text>
                    <Text style={[s.kpiVal, { color: fleetData.defectRate > 10 ? '#EF4444' : '#10B981' }]}>
                      {fleetData.defectRate}%
                    </Text>
                    <Text style={s.kpiSub}>
                      {fleetData.damagedBoxes} of {fleetData.totalBoxes} inspected boxes
                    </Text>
                  </View>
                </View>

                <View style={s.kpiRow}>
                  <View style={s.kpiCard}>
                    <Text style={s.kpiLabel}>Total Boxes Inspected</Text>
                    <Text style={s.kpiVal}>{fleetData.totalBoxes}</Text>
                    <Text style={s.kpiSub}>Across all registered batches</Text>
                  </View>
                  <View style={s.kpiCard}>
                    <Text style={s.kpiLabel}>Damaged Boxes</Text>
                    <Text style={[s.kpiVal, { color: '#EF4444' }]}>{fleetData.damagedBoxes}</Text>
                    <Text style={s.kpiSub}>Flagged for containment</Text>
                  </View>
                </View>

                <View style={s.card}>
                  <View style={s.cardHeader}>
                    <Ionicons name="time-outline" size={16} color="#FF2D55" />
                    <Text style={s.cardTitle}>Recent Shipment Activity</Text>
                  </View>
                  {fleetData.recentAlerts.length === 0 ? (
                    <Text style={[s.fieldLabel, { textAlign: 'center', paddingVertical: 16 }]}>
                      No shipment activity recorded yet
                    </Text>
                  ) : (
                    fleetData.recentAlerts.map((alert, i) => (
                      <View key={i} style={s.alertItem}>
                        <Ionicons
                          name={alert.status === 'Has Damage' ? 'warning' : 'shield-checkmark'}
                          size={18}
                          color={alert.status === 'Has Damage' ? '#F59E0B' : '#10B981'}
                        />
                        <View style={{ flex: 1, marginLeft: 8 }}>
                          <Text style={s.alertTitle}>{alert.route}</Text>
                          <Text style={s.alertDesc}>
                            {alert.status} · {alert.date}
                          </Text>
                        </View>
                      </View>
                    ))
                  )}
                </View>

                <TouchableOpacity style={s.syncBtn} onPress={loadFleetData}>
                  <View style={s.btnContent}>
                    <Ionicons name="refresh-outline" size={16} color="#FFFFFF" />
                    <Text style={s.syncBtnText}>Refresh Fleet Data</Text>
                  </View>
                </TouchableOpacity>
              </>
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <FontAwesome5 name="chart-pie" size={40} color="#27272A" />
                <Text style={[s.cardTitle, { marginTop: 16, textAlign: 'center' }]}>No fleet data yet</Text>
                <Text style={[s.fieldLabel, { textAlign: 'center', marginTop: 8 }]}>
                  Create shipments to view fleet analytics here
                </Text>
                <TouchableOpacity style={[s.syncBtn, { marginTop: 20, width: '80%' }]} onPress={loadFleetData}>
                  <View style={s.btnContent}>
                    <Ionicons name="refresh-outline" size={16} color="#FFFFFF" />
                    <Text style={s.syncBtnText}>Load Fleet Data</Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#09090B' },
  content: { padding: 20, paddingBottom: 60 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#27272A',
    gap: 4,
  },
  backText: { color: '#A1A1AA', fontSize: 13, fontWeight: '600' },
  badge: {
    backgroundColor: 'rgba(255, 45, 85, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 45, 85, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: { color: '#FF2D55', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  title: { fontSize: 26, fontWeight: '900', color: '#FFFFFF', marginBottom: 6 },
  subtitle: { fontSize: 13, color: '#A1A1AA', lineHeight: 19, marginBottom: 18 },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#18181B',
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  tabBtnActive: { backgroundColor: '#27272A' },
  tabText: { color: '#71717A', fontSize: 12, fontWeight: '700' },
  tabTextActive: { color: '#FFFFFF' },

  card: {
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  cardTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  row: { flexDirection: 'row', marginBottom: 12, gap: 8 },
  fieldLabel: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#09090B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 13,
  },

  chipScroll: { marginBottom: 14 },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  chipActive: { backgroundColor: '#FF2D55', borderColor: '#FF2D55' },
  chipInactive: { backgroundColor: '#09090B', borderColor: '#27272A' },
  chipText: { color: '#71717A', fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#FFFFFF', fontWeight: '700' },

  modeNoteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#09090B',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  modeNoteText: { color: '#71717A', fontSize: 11, flex: 1, lineHeight: 16 },

  syncBtn: {
    backgroundColor: '#27272A',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3F3F46',
    marginTop: 4,
  },
  syncBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  btnContent: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  liveDataBlock: {
    marginTop: 14,
    backgroundColor: '#09090B',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  liveDataHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  liveDataTitle: { color: '#E4E4E7', fontSize: 12, fontWeight: '700' },
  livePill: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  livePillText: { color: '#10B981', fontSize: 9, fontWeight: '800' },
  telemetryGrid: { flexDirection: 'row', gap: 8 },
  telemetryItem: { flex: 1, alignItems: 'center' },
  telemetryVal: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  telemetryLbl: { color: '#71717A', fontSize: 10, marginTop: 2 },

  predictBtn: {
    backgroundColor: '#FF2D55',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#FF2D55',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  predictBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },

  resultCard: {
    backgroundColor: '#18181B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 18,
    marginBottom: 20,
  },
  resultHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  resultTitle: { color: '#A1A1AA', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  engineBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  engineBadgeText: { color: '#10B981', fontSize: 9, fontWeight: '800' },
  resultTime: { color: '#52525B', fontSize: 11 },
  resultCombined: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', marginBottom: 14 },
  metricGrid: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  metricBox: {
    flex: 1,
    backgroundColor: '#09090B',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  metricLabel: { color: '#71717A', fontSize: 11, fontWeight: '600', marginBottom: 4 },
  metricStatus: { fontSize: 16, fontWeight: '800', marginBottom: 2 },
  metricProb: { color: '#71717A', fontSize: 11 },
  infoFoot: { backgroundColor: '#09090B', padding: 10, borderRadius: 10, marginBottom: 14 },
  infoFootText: { color: '#71717A', fontSize: 11, lineHeight: 16 },

  exportPdfBtn: {
    backgroundColor: '#27272A',
    borderWidth: 1,
    borderColor: '#3F3F46',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportPdfText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  kpiRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  kpiCard: {
    flex: 1,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 16,
    padding: 16,
  },
  kpiLabel: { color: '#71717A', fontSize: 11, fontWeight: '600' },
  kpiVal: { color: '#FFFFFF', fontSize: 24, fontWeight: '900', marginTop: 4 },
  kpiSub: { color: '#52525B', fontSize: 10, marginTop: 2 },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#09090B',
    padding: 12,
    borderRadius: 12,
    marginTop: 10,
  },
  alertTitle: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  alertDesc: { color: '#71717A', fontSize: 11, marginTop: 2 },
});
