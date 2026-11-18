import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BACKEND_URL } from '@/constants/api';

interface CandidateDay {
  date: string;
  dayName: string;
  tempMean: number;
  precipitation: number;
  windSpeed: number;
  riskScore: number;
  status: 'Recommended' | 'Moderate Risk' | 'High Weather Risk';
}

export default function DispatchScreen() {
  const { session } = useAuth();
  const [origin, setOrigin] = useState('Mumbai');
  const [destination, setDestination] = useState('New Delhi');
  const [analyzing, setAnalyzing] = useState(false);
  const [candidates, setCandidates] = useState<CandidateDay[] | null>(null);

  const handleOptimize = async () => {
    if (!origin.trim() || !destination.trim()) {
      Alert.alert('Required', 'Please enter origin and destination hubs.');
      return;
    }

    setAnalyzing(true);
    setCandidates(null);

    try {
      // Fetch open-meteo 7-day weather forecast (free, no API key required)
      // Using Delhi coordinates for transit corridor simulation (lat: 28.61, lon: 77.20)
      const weatherRes = await fetch(
        'https://api.open-meteo.com/v1/forecast?latitude=28.6139&longitude=77.2090&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&timezone=auto'
      );

      if (weatherRes.ok) {
        const weatherData = await weatherRes.json();
        const daily = weatherData.daily;
        const days: CandidateDay[] = [];

        for (let i = 0; i < Math.min(daily.time.length, 5); i++) {
          const dStr = daily.time[i];
          const tMax = daily.temperature_2m_max[i] || 25;
          const tMin = daily.temperature_2m_min[i] || 15;
          const precip = daily.precipitation_sum[i] || 0;
          const wind = daily.wind_speed_10m_max[i] || 10;
          const tMean = Math.round((tMax + tMin) / 2);

          // Calculate composite environmental risk penalty
          let risk = 0.1;
          if (precip > 5) risk += 0.35;
          else if (precip > 1) risk += 0.15;

          if (wind > 25) risk += 0.25;
          else if (wind > 15) risk += 0.1;

          if (tMax > 38 || tMin < 5) risk += 0.2;

          let status: CandidateDay['status'] = 'Recommended';
          if (risk > 0.45) status = 'High Weather Risk';
          else if (risk > 0.25) status = 'Moderate Risk';

          const dateObj = new Date(dStr);
          days.push({
            date: dStr,
            dayName: dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
            tempMean: tMean,
            precipitation: precip,
            windSpeed: wind,
            riskScore: Math.min(Math.round(risk * 100), 95),
            status,
          });
        }

        // Sort: Recommended first, lowest risk score first
        days.sort((a, b) => a.riskScore - b.riskScore);
        setCandidates(days);
      } else {
        Alert.alert('Weather Service Unavailable', 'Could not fetch forecast data from Open-Meteo.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Optimization routine failed.');
    } finally {
      setAnalyzing(false);
    }
  };

  const getStatusColor = (s: string) => {
    if (s === 'Recommended') return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' };
    if (s === 'High Weather Risk') return { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30' };
    return { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' };
  };

  return (
    <ScrollView className="flex-1 bg-zinc-950" contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
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
          <Text className="text-red-500 text-xs font-bold uppercase tracking-wider">Open-Meteo AI</Text>
        </View>
      </View>

      <Text className="text-2xl font-black text-white mb-1">Dispatch Window Optimizer</Text>
      <Text className="text-zinc-400 text-xs mb-6">
        Simulate multi-day transit forecasts to select the safest departure date with lowest damage likelihood.
      </Text>

      <View className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-6">
        <View className="flex-row gap-3 mb-3">
          <View className="flex-1">
            <Text className="text-zinc-400 text-xs font-semibold mb-1 uppercase tracking-wider">Origin Hub</Text>
            <TextInput
              className="bg-zinc-950 border border-zinc-800 text-white rounded-xl px-4 py-2.5 text-xs"
              value={origin}
              onChangeText={setOrigin}
              placeholder="e.g. Mumbai"
              placeholderTextColor="#71717A"
            />
          </View>
          <View className="flex-1">
            <Text className="text-zinc-400 text-xs font-semibold mb-1 uppercase tracking-wider">Destination Hub</Text>
            <TextInput
              className="bg-zinc-950 border border-zinc-800 text-white rounded-xl px-4 py-2.5 text-xs"
              value={destination}
              onChangeText={setDestination}
              placeholder="e.g. New Delhi"
              placeholderTextColor="#71717A"
            />
          </View>
        </View>

        <TouchableOpacity
          className="bg-red-500 active:bg-red-600 rounded-xl py-3.5 items-center mt-2 shadow-lg shadow-red-500/20"
          onPress={handleOptimize}
          disabled={analyzing}
        >
          {analyzing ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-bold text-xs uppercase tracking-wider">Analyze 5-Day Weather Windows</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Candidate Day Recommendations */}
      {candidates && (
        <View>
          <Text className="text-sm font-bold text-white mb-3">Ranked Departure Windows</Text>
          <View className="gap-3">
            {candidates.map((c, index) => {
              const badge = getStatusColor(c.status);
              return (
                <View
                  key={c.date}
                  className={`bg-zinc-900 border rounded-2xl p-4 ${
                    index === 0 ? 'border-emerald-500/50 bg-emerald-950/10' : 'border-zinc-800'
                  }`}
                >
                  <View className="flex-row justify-between items-start mb-2">
                    <View>
                      <View className="flex-row items-center gap-2">
                        {index === 0 && (
                          <View className="bg-emerald-500 px-2 py-0.5 rounded-md">
                            <Text className="text-black text-[9px] font-black uppercase">Best Choice</Text>
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

                  <View className="flex-row gap-4 mt-2 pt-2 border-t border-zinc-800/80">
                    <View className="flex-row items-center gap-1.5">
                      <MaterialCommunityIcons name="thermometer" size={14} color="#A1A1AA" />
                      <Text className="text-zinc-300 text-xs">{c.tempMean}°C avg</Text>
                    </View>
                    <View className="flex-row items-center gap-1.5">
                      <MaterialCommunityIcons name="weather-rainy" size={14} color="#A1A1AA" />
                      <Text className="text-zinc-300 text-xs">{c.precipitation} mm rain</Text>
                    </View>
                    <View className="flex-row items-center gap-1.5">
                      <MaterialCommunityIcons name="weather-windy" size={14} color="#A1A1AA" />
                      <Text className="text-zinc-300 text-xs">{c.windSpeed} km/h wind</Text>
                    </View>
                    <Text className="text-zinc-500 text-xs ml-auto font-mono">
                      Risk: {c.riskScore}%
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

