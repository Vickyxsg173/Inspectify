import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  Package,
  Smartphone,
  Video,
  Cctv,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Truck,
  Plus,
  Layers,
  Camera,
  ChevronDown,
  ChevronUp,
  ScanLine,
} from 'lucide-react-native';
import { ThemeToggle } from '@/components/ThemeToggle';
import { getRecentScans, ScanRecord, formatRelativeTime } from '@/utils/scanStorage';
import { getSelectedModel, AVAILABLE_MODELS } from '@/utils/modelStorage';
import {
  getActiveShipmentId,
  getShipments,
  setActiveShipmentId,
} from '@/utils/shipmentStorage';
import { ShipmentTraceabilityModal } from '@/components/ShipmentTraceabilityModal';
import { useColorScheme } from 'nativewind';

export default function HomeScreen() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [recentScans, setRecentScans] = useState<ScanRecord[]>([]);
  const [activeModelName, setActiveModelName] = useState('Standard');
  const [activeShipmentId, setActiveShipmentIdState] = useState('');
  const [shipmentCount, setShipmentCount] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [isInspectionExpanded, setIsInspectionExpanded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      async function loadMeta() {
        const scans = await getRecentScans(3);
        setRecentScans(scans);

        const modelId = await getSelectedModel();
        const modelObj = AVAILABLE_MODELS.find((m) => m.id === modelId);
        if (modelObj) setActiveModelName(modelObj.name);

        const shpId = await getActiveShipmentId();
        setActiveShipmentIdState(shpId);

        const allShps = await getShipments();
        setShipmentCount(allShps.length);
      }
      loadMeta();
    }, [])
  );

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black">
      <ScrollView
        className="flex-1 px-5"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 48 }}
      >
        {/* Header */}
        <View className="flex-row justify-between items-center py-5">
          <View>
            <Text className="text-3xl font-extrabold text-black dark:text-white tracking-tight">
              Inspectify
            </Text>
            <Text className="text-zinc-600 dark:text-zinc-400 font-medium text-sm mt-1">
              Smart quality check for boxes & screens
            </Text>
          </View>
          <ThemeToggle />
        </View>

        {/* Current Active Shipment Bar */}
        <View className="mb-5 p-4 rounded-2xl bg-zinc-100 dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800">
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center gap-2.5 flex-1 pr-2">
              <View className="w-8 h-8 rounded-lg bg-[#FF2D55]/10 items-center justify-center">
                <Truck size={18} color="#FF2D55" />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  Current Batch
                </Text>
                <Text className="text-base font-bold text-black dark:text-white" numberOfLines={1}>
                  {activeShipmentId || 'Loading...'}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={() => setModalVisible(true)}
              className="bg-white dark:bg-[#202026] px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 active:opacity-80"
            >
              <Text className="text-xs font-bold text-[#FF2D55]">Change</Text>
            </Pressable>
          </View>

          <Text className="text-xs text-zinc-500 dark:text-zinc-400">
            {shipmentCount > 0 ? `${shipmentCount} batch(es) saved on device` : 'No batches saved yet'}
          </Text>
        </View>

        {/* Expandable Start Inspection Menu */}
        <View className="mb-6">
          <Pressable
            onPress={() => setIsInspectionExpanded((prev) => !prev)}
            className="bg-zinc-50 dark:bg-[#121216] p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex-row items-center justify-between mb-3 active:opacity-85 shadow-sm"
          >
            <View className="flex-row items-center gap-3">
              {/* Distinct Parent Master Icon (Solid Red with White ScanLine) */}
              <View className="w-11 h-11 rounded-xl bg-[#FF2D55] items-center justify-center shadow-sm">
                <ScanLine size={22} color="#FFFFFF" />
              </View>
              <View>
                <Text className="text-lg font-bold text-black dark:text-white">
                  Start Inspection
                </Text>
                <Text className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {isInspectionExpanded ? '4 inspection modes • Tap to collapse' : 'Tap to expand inspection options'}
                </Text>
              </View>
            </View>

            {/* High-Contrast Explicit Up/Down Toggle Button */}
            <View className="w-9 h-9 rounded-full bg-zinc-200/80 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 items-center justify-center">
              {isInspectionExpanded ? (
                <ChevronUp size={20} color={isDark ? '#FFFFFF' : '#18181B'} />
              ) : (
                <ChevronDown size={20} color={isDark ? '#FFFFFF' : '#18181B'} />
              )}
            </View>
          </Pressable>

          {isInspectionExpanded && (
            <View className="gap-3">
              {/* 1. Box Packaging Card */}
              <Pressable
                onPress={() => router.push({ pathname: '/image-inspect' as any, params: { mode: 'package' } })}
                className="bg-zinc-50 dark:bg-[#121216] p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex-row items-center justify-between active:opacity-80 shadow-sm"
              >
                <View className="flex-row items-center gap-3.5 flex-1 pr-2">
                  <View className="w-11 h-11 rounded-xl bg-[#FF2D55]/10 dark:bg-[#FF2D55]/15 border border-[#FF2D55]/20 items-center justify-center">
                    <Package size={22} color="#FF2D55" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-bold text-black dark:text-white">
                      Box Packaging
                    </Text>
                    <Text className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Check boxes for dents, tears, and crushed corners
                    </Text>
                  </View>
                </View>
                <ArrowRight size={18} color="#FF2D55" />
              </Pressable>

              {/* 2. Screen Glass Card */}
              <Pressable
                onPress={() => router.push({ pathname: '/image-inspect' as any, params: { mode: 'screen' } })}
                className="bg-zinc-50 dark:bg-[#121216] p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex-row items-center justify-between active:opacity-80 shadow-sm"
              >
                <View className="flex-row items-center gap-3.5 flex-1 pr-2">
                  <View className="w-11 h-11 rounded-xl bg-[#FF2D55]/10 dark:bg-[#FF2D55]/15 border border-[#FF2D55]/20 items-center justify-center">
                    <Smartphone size={22} color="#FF2D55" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-bold text-black dark:text-white">
                      Screen Glass
                    </Text>
                    <Text className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Scan mobile displays for cracks and scratches
                    </Text>
                  </View>
                </View>
                <ArrowRight size={18} color="#FF2D55" />
              </Pressable>

              {/* 3. Live Camera Card */}
              <Pressable
                onPress={() => router.push({ pathname: '/live-video' as any, params: { mode: 'live' } })}
                className="bg-zinc-50 dark:bg-[#121216] p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex-row items-center justify-between active:opacity-80 shadow-sm"
              >
                <View className="flex-row items-center gap-3.5 flex-1 pr-2">
                  <View className="w-11 h-11 rounded-xl bg-[#FF2D55]/10 dark:bg-[#FF2D55]/15 border border-[#FF2D55]/20 items-center justify-center">
                    <Cctv size={22} color="#FF2D55" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-bold text-black dark:text-white">
                      Live Camera
                    </Text>
                    <Text className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Point camera to detect damage in real time
                    </Text>
                  </View>
                </View>
                <ArrowRight size={18} color="#FF2D55" />
              </Pressable>

              {/* 4. Video Inspection Card */}
              <Pressable
                onPress={() => router.push({ pathname: '/live-video' as any, params: { mode: 'video' } })}
                className="bg-zinc-50 dark:bg-[#121216] p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex-row items-center justify-between active:opacity-80 shadow-sm"
              >
                <View className="flex-row items-center gap-3.5 flex-1 pr-2">
                  <View className="w-11 h-11 rounded-xl bg-[#FF2D55]/10 dark:bg-[#FF2D55]/15 border border-[#FF2D55]/20 items-center justify-center">
                    <Video size={22} color="#FF2D55" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-bold text-black dark:text-white">
                      Video Inspection
                    </Text>
                    <Text className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Upload or record a video to inspect batches
                    </Text>
                  </View>
                </View>
                <ArrowRight size={18} color="#FF2D55" />
              </Pressable>
            </View>
          )}
        </View>

        {/* Simple How It Works Guide */}
        <View className="mb-6">
          <Text className="text-xl font-bold text-black dark:text-white mb-3">
            How It Works
          </Text>

          <View className="gap-2.5">
            <View className="bg-zinc-50 dark:bg-[#121216] p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex-row items-center gap-3.5">
              <View className="w-8 h-8 rounded-full bg-[#FF2D55] items-center justify-center">
                <Text className="text-white text-sm font-bold">1</Text>
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-black dark:text-white">
                  Take or upload a photo
                </Text>
                <Text className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Hold camera 15-30cm away with good lighting
                </Text>
              </View>
            </View>

            <View className="bg-zinc-50 dark:bg-[#121216] p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex-row items-center gap-3.5">
              <View className="w-8 h-8 rounded-full bg-[#FF2D55] items-center justify-center">
                <Text className="text-white text-sm font-bold">2</Text>
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-black dark:text-white">
                  Get instant diagnosis
                </Text>
                <Text className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Damage is highlighted in red with an instant pass or fail verdict
                </Text>
              </View>
            </View>

            <View className="bg-zinc-50 dark:bg-[#121216] p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex-row items-center gap-3.5">
              <View className="w-8 h-8 rounded-full bg-[#FF2D55] items-center justify-center">
                <Text className="text-white text-sm font-bold">3</Text>
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-black dark:text-white">
                  File claims or save record
                </Text>
                <Text className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Draft support emails automatically in the AI Support tab
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Recent Scans */}
        {recentScans.length > 0 && (
          <View>
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-xl font-bold text-black dark:text-white">
                Recent Scans
              </Text>
              <Pressable onPress={() => router.push('/settings' as any)}>
                <Text className="text-sm font-bold text-[#FF2D55]">View All</Text>
              </Pressable>
            </View>

            <View className="gap-2.5">
              {recentScans.map((scan) => {
                const isDefect = scan.status.toUpperCase() === 'DEFECTIVE';
                return (
                  <View
                    key={scan.id}
                    className="bg-white dark:bg-[#121216] p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex-row items-center justify-between shadow-sm"
                  >
                    <View className="flex-row items-center gap-3 flex-1 pr-2">
                      <Image
                        source={{ uri: scan.imageUri }}
                        className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800"
                      />
                      <View className="flex-1">
                        <Text className="text-sm font-bold text-black dark:text-white" numberOfLines={1}>
                          {scan.title}
                        </Text>
                        <Text className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                          {formatRelativeTime(scan.timestamp)}
                        </Text>
                      </View>
                    </View>
                    <View
                      className={`px-3 py-1 rounded-full ${
                        isDefect
                          ? 'bg-[#FF2D55]/10'
                          : 'bg-emerald-500/10'
                      }`}
                    >
                      <Text
                        className={`text-xs font-bold ${
                          isDefect ? 'text-[#FF2D55]' : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {isDefect ? 'DEFECT' : 'PASS'}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Shipment Intake Modal */}
      <ShipmentTraceabilityModal
        visible={modalVisible}
        activeShipmentId={activeShipmentId}
        isDark={isDark}
        onClose={() => setModalVisible(false)}
        onSelectShipment={async (id) => {
          await setActiveShipmentId(id);
          setActiveShipmentIdState(id);
        }}
        onShipmentsChanged={async () => {
          const shps = await getShipments();
          setShipmentCount(shps.length);
        }}
      />
    </SafeAreaView>
  );
}
