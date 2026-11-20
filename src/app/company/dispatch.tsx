import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import {
  getDispatchAiInsights,
  DispatchCandidateDay,
  DispatchAiInsight,
} from '../../services/dispatchAiService';
import { LocationSearchInput } from '../../components/LocationSearchInput';

type TransportMode = 'Road' | 'Air' | 'Sea' | 'Rail';

const TIME_WINDOWS = [
  '06:00 AM (Early Morning)',
  '10:00 AM (Mid Morning)',
  '02:00 PM (Afternoon)',
  '06:00 PM (Evening)',
  '10:00 PM (Overnight)',
];

const MODE_CONFIG: Record<
  TransportMode,
  {
    icon: string;
    label: string;
    precipWeight: number;
    windWeight: number;
    heatWeight: number;
    coldWeight: number;
    windThresholdHigh: number;
    windThresholdMed: number;
    timingTips: string[];
    description: string;
  }
> = {
  Road: {
    icon: 'car',
    label: 'Road',
    precipWeight: 0.4,
    windWeight: 0.2,
    heatWeight: 0.2,
    coldWeight: 0.15,
    windThresholdHigh: 25,
    windThresholdMed: 15,
    description: 'Wind & precipitation are primary risks. High rain raises cardboard puncture probability.',
    timingTips: [
      'Early morning (5–9 AM) preferred — lower traffic & peak heat avoided.',
      'Avoid 12–4 PM departures in summer (high road surface temp).',
      'Evening (6–9 PM) is a good secondary window for urban routes.',
    ],
  },
  Air: {
    icon: 'airplane',
    label: 'Air',
    precipWeight: 0.15,
    windWeight: 0.5,
    heatWeight: 0.25,
    coldWeight: 0.3,
    windThresholdHigh: 15,
    windThresholdMed: 8,
    description: 'Wind speed is critical for air. Even moderate gusts at airport raise handling damage risk.',
    timingTips: [
      'Morning flights (6–9 AM) have calmer winds and lower turbulence.',
      'Avoid late afternoon and evening — convective turbulence peaks.',
      'Cold nights are preferable for sensitive electronics cargo.',
    ],
  },
  Sea: {
    icon: 'boat',
    label: 'Sea',
    precipWeight: 0.2,
    windWeight: 0.45,
    heatWeight: 0.1,
    coldWeight: 0.1,
    windThresholdHigh: 20,
    windThresholdMed: 12,
    description: 'High swell driven by wind is the dominant sea risk. Prolonged humidity also damages packaging.',
    timingTips: [
      'Avoid monsoon season (Jun–Sep) for sea freight on Indian Ocean routes.',
      'Morning departure allows port handling in daylight hours.',
      'Ensure cargo is sealed against salt-air — especially electronics.',
    ],
  },
  Rail: {
    icon: 'train',
    label: 'Rail',
    precipWeight: 0.2,
    windWeight: 0.05,
    heatWeight: 0.1,
    coldWeight: 0.1,
    windThresholdHigh: 40,
    windThresholdMed: 25,
    description: 'Rail has minimal weather risk. Watch out for shunting impact at junctions — secure heavy items.',
    timingTips: [
      'Rail timing is mostly infrastructure-dependent, not weather-driven.',
      'Avoid freight loading during peak maintenance windows (usually 2–5 AM).',
      'Pad heavy/rigid items to absorb junction shunting shocks.',
    ],
  },
};

export default function DispatchScreen() {
  const { accountType } = useAuth();

  // Guard: company feature only
  useEffect(() => {
    if (accountType === 'personal') {
      Alert.alert('Company Access Only', 'This feature is exclusively for enterprise accounts.');
      router.replace('/');
    }
  }, [accountType]);

  const [origin, setOrigin] = useState('Mumbai, Maharashtra');
  const [destination, setDestination] = useState('New Delhi, Delhi');
  const [originCoords, setOriginCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [destCoords, setDestCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [transportMode, setTransportMode] = useState<TransportMode>('Road');

  // Explicit Planned Dispatch Date & Time fields
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>(TIME_WINDOWS[0]);

  const [analyzing, setAnalyzing] = useState(false);
  const [candidates, setCandidates] = useState<DispatchCandidateDay[] | null>(null);

  // Context-aware LLM insights
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiInsight, setAiInsight] = useState<DispatchAiInsight | null>(null);

  const modeConfig = MODE_CONFIG[transportMode];

  const geocodeCity = async (city: string, stored: { lat: number; lon: number } | null) => {
    if (stored) return stored;
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city.trim())}&format=json&limit=1`,
      { headers: { 'User-Agent': 'InspectifyApp/1.0' } }
    );
    const data = await res.json();
    if (!data || data.length === 0) throw new Error(`Could not locate city: ${city}`);
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  };

  const handleOptimize = async () => {
    if (!origin.trim() || !destination.trim()) {
      Alert.alert('Required', 'Please enter origin and destination hubs.');
      return;
    }

    setAnalyzing(true);
    setCandidates(null);
    setAiInsight(null);

    try {
      const oc = await geocodeCity(origin, originCoords);
      const dc = await geocodeCity(destination, destCoords);
      setOriginCoords(oc);
      setDestCoords(dc);

      const midLat = (oc.lat + dc.lat) / 2;
      const midLon = (oc.lon + dc.lon) / 2;

      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${midLat}&longitude=${midLon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&timezone=auto`
      );

      if (!weatherRes.ok) {
        Alert.alert('Weather Service Unavailable', 'Could not fetch forecast data from Open-Meteo.');
        return;
      }

      const weatherData = await weatherRes.json();
      const daily = weatherData.daily;
      const days: DispatchCandidateDay[] = [];
      const cfg = MODE_CONFIG[transportMode];

      for (let i = 0; i < Math.min(daily.time.length, 5); i++) {
        const dStr = daily.time[i];
        const tMax = daily.temperature_2m_max[i] || 25;
        const tMin = daily.temperature_2m_min[i] || 15;
        const precip = daily.precipitation_sum[i] || 0;
        const wind = daily.wind_speed_10m_max[i] || 10;
        const tMean = Math.round((tMax + tMin) / 2);

        let risk = 0.05;
        if (precip > 5) risk += cfg.precipWeight;
        else if (precip > 1) risk += cfg.precipWeight * 0.4;

        if (wind > cfg.windThresholdHigh) risk += cfg.windWeight;
        else if (wind > cfg.windThresholdMed) risk += cfg.windWeight * 0.4;

        if (tMax > 38) risk += cfg.heatWeight;
        else if (tMax > 32) risk += cfg.heatWeight * 0.4;

        if (tMin < 2) risk += cfg.coldWeight;
        else if (tMin < 8) risk += cfg.coldWeight * 0.4;

        let status: DispatchCandidateDay['status'] = 'Recommended';
        if (risk > 0.45) status = 'High Weather Risk';
        else if (risk > 0.25) status = 'Moderate Risk';

        const tipIdx = Math.min(Math.floor(risk * 3), cfg.timingTips.length - 1);
        const timingTip = cfg.timingTips[tipIdx];

        const dateObj = new Date(dStr);
        days.push({
          date: dStr,
          dayName: dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
          tempMean: tMean,
          precipitation: precip,
          windSpeed: wind,
          riskScore: Math.min(Math.round(risk * 100), 95),
          status,
          timingTip,
        });
      }

      // Sort by risk: lowest first
      days.sort((a, b) => a.riskScore - b.riskScore);
      setCandidates(days);

      // Default planned date to lowest risk day if unset
      const initialDate = selectedDate || days[0].date;
      if (!selectedDate) {
        setSelectedDate(initialDate);
      }

      // Generate context-aware LLM insights
      generateAiInsights(days, initialDate, selectedTime);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Optimization routine failed. Check internet connection.');
    } finally {
      setAnalyzing(false);
    }
  };

  const generateAiInsights = async (
    candidateList: DispatchCandidateDay[],
    targetDate: string,
    targetTime: string
  ) => {
    setLoadingAi(true);
    try {
      const insight = await getDispatchAiInsights(
        origin,
        destination,
        transportMode,
        targetDate || candidateList[0].date,
        targetTime,
        candidateList
      );
      setAiInsight(insight);
    } catch (e: any) {
      console.warn('AI Insights notice:', e.message);
    } finally {
      setLoadingAi(false);
    }
  };

  const getStatusColor = (status: string) => {
    if (status === 'Recommended') return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' };
    if (status === 'High Weather Risk') return { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30' };
    return { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' };
  };

  const getModeIcon = (mode: TransportMode) => {
    const icons: Record<TransportMode, string> = {
      Road: 'car-outline',
      Air: 'airplane-outline',
      Sea: 'boat-outline',
      Rail: 'train-outline',
    };
    return icons[mode] as any;
  };

  return (
    <SafeAreaView className="flex-1 bg-zinc-950">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
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
          <View className="bg-red-500/10 border border-red-500/30 px-3 py-1 rounded-full">
            <Text className="text-red-500 text-xs font-bold uppercase tracking-wider">AI Route Intelligence</Text>
          </View>
        </View>

        <Text className="text-2xl font-black text-white mb-1">Dispatch Window Optimizer</Text>
        <Text className="text-zinc-400 text-xs mb-6">
          Predict multi-day weather, evaluate real-world traffic bottlenecks, and receive context-aware departure timing recommendations.
        </Text>

        {/* Transport Mode Selector */}
        <View className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-4">
          <Text className="text-zinc-400 text-xs font-bold uppercase tracking-wider mb-3">Transport Mode</Text>
          <View className="flex-row gap-2 flex-wrap">
            {(Object.keys(MODE_CONFIG) as TransportMode[]).map((mode) => (
              <TouchableOpacity
                key={mode}
                onPress={() => {
                  setTransportMode(mode);
                  setCandidates(null);
                  setAiInsight(null);
                }}
                className={`flex-row items-center gap-1.5 px-4 py-2 rounded-xl border ${
                  transportMode === mode
                    ? 'bg-red-500 border-red-500'
                    : 'bg-zinc-950 border-zinc-700'
                }`}
              >
                <Ionicons
                  name={getModeIcon(mode)}
                  size={14}
                  color={transportMode === mode ? '#FFFFFF' : '#71717A'}
                />
                <Text
                  className={`text-xs font-bold ${
                    transportMode === mode ? 'text-white' : 'text-zinc-400'
                  }`}
                >
                  {mode}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View className="mt-3 bg-zinc-950 rounded-xl p-3 border border-zinc-800 flex-row items-start gap-2">
            <Ionicons name="information-circle-outline" size={14} color="#71717A" />
            <Text className="text-zinc-500 text-xs flex-1 leading-4">{modeConfig.description}</Text>
          </View>
        </View>

        {/* Origin & Destination Hubs with Live Google Maps style Suggestions */}
        <View className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-6">
          <View className="flex-row gap-3 mb-3">
            <LocationSearchInput
              label="Origin Hub / Address"
              value={origin}
              onChangeText={setOrigin}
              onSelect={(name, lat, lon) => {
                setOrigin(name);
                setOriginCoords({ lat, lon });
              }}
              placeholder="e.g. Mumbai Logistics Hub"
            />
            <LocationSearchInput
              label="Destination Hub / Address"
              value={destination}
              onChangeText={setDestination}
              onSelect={(name, lat, lon) => {
                setDestination(name);
                setDestCoords({ lat, lon });
              }}
              placeholder="e.g. New Delhi Terminal"
            />
          </View>

          <TouchableOpacity
            className="bg-red-500 active:bg-red-600 rounded-xl py-3.5 items-center mt-2 shadow-lg shadow-red-500/20"
            onPress={handleOptimize}
            disabled={analyzing}
          >
            {analyzing ? (
              <View className="flex-row items-center gap-2">
                <ActivityIndicator color="white" size="small" />
                <Text className="text-white font-bold text-xs">Simulating Route Telemetry…</Text>
              </View>
            ) : (
              <Text className="text-white font-bold text-xs uppercase tracking-wider">
                Analyze 5-Day Windows & Traffic Risk
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Planned Dispatch Date & Time Selection */}
        {candidates && (
          <View className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-6">
            <Text className="text-white font-bold text-sm mb-1">Your Planned Departure Window</Text>
            <Text className="text-zinc-500 text-xs mb-3">
              Select or type your planned departure date and time slot to receive customized corridor risk analysis.
            </Text>

            {/* Explicit Date Input Field */}
            <Text className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider mb-1.5">
              Target Dispatch Date (YYYY-MM-DD)
            </Text>
            <TextInput
              className="bg-zinc-950 border border-zinc-800 text-white rounded-xl px-4 py-2.5 text-xs mb-3 font-mono"
              value={selectedDate}
              onChangeText={(text) => {
                setSelectedDate(text);
                if (candidates) {
                  generateAiInsights(candidates, text, selectedTime);
                }
              }}
              placeholder="e.g. 2026-11-21"
              placeholderTextColor="#71717A"
            />

            {/* Quick Date selection chips */}
            <Text className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider mb-2">
              Quick Select From 5-Day Forecast
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
              <View className="flex-row gap-2">
                {candidates.map((c) => {
                  const sel = selectedDate === c.date;
                  return (
                    <TouchableOpacity
                      key={c.date}
                      onPress={() => {
                        setSelectedDate(c.date);
                        generateAiInsights(candidates, c.date, selectedTime);
                      }}
                      className={`px-3 py-2 rounded-xl border ${
                        sel ? 'bg-red-500 border-red-500' : 'bg-zinc-950 border-zinc-800'
                      }`}
                    >
                      <Text className={`text-xs font-bold ${sel ? 'text-white' : 'text-zinc-300'}`}>{c.dayName}</Text>
                      <Text className={`text-[10px] ${sel ? 'text-white/80' : 'text-zinc-500'}`}>Risk: {c.riskScore}%</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* Time selection chips */}
            <Text className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider mb-2">Planned Time Slot</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-2">
                {TIME_WINDOWS.map((t) => {
                  const sel = selectedTime === t;
                  return (
                    <TouchableOpacity
                      key={t}
                      onPress={() => {
                        setSelectedTime(t);
                        generateAiInsights(candidates, selectedDate || candidates[0].date, t);
                      }}
                      className={`px-3 py-1.5 rounded-lg border ${
                        sel ? 'bg-zinc-800 border-zinc-600' : 'bg-zinc-950 border-zinc-850'
                      }`}
                    >
                      <Text className={`text-xs font-medium ${sel ? 'text-white font-bold' : 'text-zinc-400'}`}>{t}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        )}

        {/* CONTEXT-AWARE LLM AI INSIGHTS CARD */}
        {aiInsight && (
          <View className="bg-zinc-900 border border-red-500/30 rounded-2xl p-4 mb-6 shadow-sm">
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center gap-2">
                <View className="w-2 h-2 rounded-full bg-red-500" />
                <Text className="text-white font-bold text-sm">AI Traffic & Corridor Intelligence</Text>
              </View>
              {loadingAi ? (
                <ActivityIndicator color="#FF2D55" size="small" />
              ) : (
                <View className="bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/30">
                  <Text className="text-emerald-400 text-[9px] font-bold uppercase">Context Aware</Text>
                </View>
              )}
            </View>

            {/* Real traffic conditions */}
            <View className="bg-zinc-950 rounded-xl p-3 border border-zinc-800 mb-3">
              <View className="flex-row items-center gap-1.5 mb-1">
                <MaterialCommunityIcons name="traffic-light" size={14} color="#F59E0B" />
                <Text className="text-amber-400 text-xs font-bold uppercase tracking-wider">
                  Corridor Traffic & Bottleneck Forecast
                </Text>
              </View>
              <Text className="text-zinc-300 text-xs leading-5">{aiInsight.trafficConditionAnalysis}</Text>
            </View>

            {/* Operator Selected Window Verdict */}
            <View className="bg-zinc-950 rounded-xl p-3 border border-zinc-800 mb-3">
              <View className="flex-row items-center gap-1.5 mb-1">
                <Ionicons name="calendar-outline" size={13} color="#3B82F6" />
                <Text className="text-blue-400 text-xs font-bold uppercase tracking-wider">
                  Your Selected Departure Assessment ({selectedDate || 'Target Day'} at {selectedTime})
                </Text>
              </View>
              <Text className="text-zinc-300 text-xs leading-5">{aiInsight.selectedDepartureVerdict}</Text>
            </View>

            {/* Recommended Alternative Window (Aligned with App Candidates) */}
            <View className="bg-emerald-950/20 border border-emerald-500/40 rounded-xl p-3 mb-3">
              <View className="flex-row items-center gap-1.5 mb-1">
                <Ionicons name="sparkles" size={13} color="#10B981" />
                <Text className="text-emerald-400 text-xs font-bold uppercase tracking-wider">
                  Optimal Timing Recommendation (App-Aligned)
                </Text>
              </View>
              <Text className="text-zinc-200 text-xs leading-5">{aiInsight.recommendedAlternative}</Text>
            </View>

            {/* Actionable Directives */}
            {aiInsight.actionableRecommendations && aiInsight.actionableRecommendations.length > 0 && (
              <View>
                <Text className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider mb-2">
                  Actionable Dispatch Directives
                </Text>
                {aiInsight.actionableRecommendations.map((rec, i) => (
                  <View key={i} className="flex-row items-start gap-2 mb-1.5">
                    <View className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5" />
                    <Text className="text-zinc-400 text-xs flex-1 leading-4">{rec}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Ranked Candidate Days */}
        {candidates && (
          <View>
            <Text className="text-sm font-bold text-white mb-3">
              Ranked {transportMode} Departure Windows
            </Text>
            <View className="gap-3">
              {candidates.map((c, index) => {
                const badge = getStatusColor(c.status);
                const isSelected = selectedDate === c.date;
                return (
                  <TouchableOpacity
                    key={c.date}
                    activeOpacity={0.8}
                    onPress={() => {
                      setSelectedDate(c.date);
                      generateAiInsights(candidates, c.date, selectedTime);
                    }}
                    className={`bg-zinc-900 border rounded-2xl p-4 ${
                      isSelected
                        ? 'border-red-500/80 bg-red-950/10'
                        : index === 0
                        ? 'border-emerald-500/50 bg-emerald-950/10'
                        : 'border-zinc-800'
                    }`}
                  >
                    <View className="flex-row justify-between items-start mb-2">
                      <View>
                        <View className="flex-row items-center gap-2">
                          {index === 0 && (
                            <View className="bg-emerald-500 px-2 py-0.5 rounded-md">
                              <Text className="text-black text-[9px] font-black uppercase">Lowest Risk</Text>
                            </View>
                          )}
                          {isSelected && (
                            <View className="bg-red-500 px-2 py-0.5 rounded-md">
                              <Text className="text-white text-[9px] font-black uppercase">Selected</Text>
                            </View>
                          )}
                          <Text className="text-white font-black text-sm">{c.dayName}</Text>
                        </View>
                        <Text className="text-zinc-500 text-xs mt-0.5">Date: {c.date}</Text>
                      </View>
                      <View className={`px-2.5 py-1 rounded-full border ${badge.bg} ${badge.border}`}>
                        <Text className={`text-[10px] font-bold uppercase tracking-wider ${badge.text}`}>
                          {c.status}
                        </Text>
                      </View>
                    </View>

                    <View className="flex-row gap-3 mt-2 pt-2 border-t border-zinc-800/80 flex-wrap">
                      <View className="flex-row items-center gap-1.5">
                        <MaterialCommunityIcons name="thermometer" size={14} color="#A1A1AA" />
                        <Text className="text-zinc-300 text-xs">{c.tempMean}°C avg</Text>
                      </View>
                      <View className="flex-row items-center gap-1.5">
                        <MaterialCommunityIcons name="weather-rainy" size={14} color="#A1A1AA" />
                        <Text className="text-zinc-300 text-xs">{c.precipitation} mm</Text>
                      </View>
                      <View className="flex-row items-center gap-1.5">
                        <MaterialCommunityIcons name="weather-windy" size={14} color="#A1A1AA" />
                        <Text className="text-zinc-300 text-xs">{c.windSpeed} km/h</Text>
                      </View>
                      <Text className="text-zinc-500 text-xs ml-auto font-mono">Risk: {c.riskScore}%</Text>
                    </View>

                    <View className="mt-2 bg-zinc-950 rounded-xl px-3 py-2 border border-zinc-800 flex-row items-start gap-2">
                      <Ionicons name="bulb-outline" size={12} color="#FF2D55" />
                      <Text className="text-zinc-500 text-[11px] flex-1 leading-4">{c.timingTip}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
