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
  Truck,
  Sparkles,
  BarChart3,
  CalendarCheck,
  PlusCircle,
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
import { useAuth } from '@/contexts/AuthContext';

export default function HomeScreen() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { user, session, accountType, companyName } = useAuth();

  const [recentScans, setRecentScans] = useState<ScanRecord[]>([]);
  const [activeModelName, setActiveModelName] = useState('Standard');
  const [activeShipmentId, setActiveShipmentIdState] = useState('');
  const [shipmentCount, setShipmentCount] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);

  const isCompany = accountType === 'company';

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
              AI Logistics & Parcel Damage Platform
            </Text>
          </View>
          <ThemeToggle />
        </View>

        {/* Role & Account Banner */}
        <View className="mb-5 p-4 rounded-2xl bg-zinc-100 dark:bg-[#141418] border border-red-500/30 flex-row items-center justify-between shadow-sm">
          <View className="flex-row items-center gap-3 flex-1 pr-2">
            <View className="w-10 h-10 rounded-xl bg-red-500 items-center justify-center">
              <ShieldCheck size={20} color="white" />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <Text className="text-[11px] font-bold text-red-500 uppercase tracking-widest">
                  {isCompany ? 'Enterprise Account' : 'Personal Recipient'}
                </Text>
                <View className="w-2 h-2 rounded-full bg-emerald-500" />
              </View>
              <Text className="text-base font-bold text-black dark:text-white" numberOfLines={1}>
                {companyName || user?.email}
              </Text>
              <Text className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {isCompany
                  ? 'Access multi-box batches, route analytics & dispatch optimizer'
                  : 'Zero-input parcel scanning & screen shock risk diagnosis'}
              </Text>
            </View>
          </View>
          {isCompany && (
            <Pressable
              onPress={() => router.push('/company/dashboard' as any)}
              className="bg-red-500 px-3 py-1.5 rounded-xl flex-row items-center gap-1 active:opacity-85"
            >
              <Text className="text-white text-xs font-bold">Portal</Text>
              <ArrowRight size={14} color="white" />
            </Pressable>
          )}
        </View>

        {/* ========================================================================= */}
        {/* COMPANY ONLY SECTION: Active Batches, Route Analytics & Dispatch Tools    */}
        {/* ========================================================================= */}
        {isCompany && (
          <View className="mb-6">
            <Text className="text-xs font-bold uppercase tracking-wider text-red-500 mb-3">
              Enterprise Logistics Suite
            </Text>

            {/* Current Active Shipment Quickbar */}
            <View className="mb-3.5 p-4 rounded-2xl bg-zinc-50 dark:bg-[#121216] border border-zinc-200 dark:border-zinc-800">
              <View className="flex-row items-center justify-between mb-1.5">
                <View className="flex-row items-center gap-2.5 flex-1 pr-2">
                  <View className="w-8 h-8 rounded-lg bg-[#FF2D55]/10 items-center justify-center">
                    <Truck size={17} color="#FF2D55" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                      Active Shipment Batch
                    </Text>
                    <Text className="text-sm font-bold text-black dark:text-white" numberOfLines={1}>
                      {activeShipmentId || 'No active batch selected'}
                    </Text>
                  </View>
                </View>

                <Pressable
                  onPress={() => setModalVisible(true)}
                  className="bg-white dark:bg-[#202026] px-3 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 active:opacity-80"
                >
                  <Text className="text-xs font-bold text-[#FF2D55]">Change</Text>
                </Pressable>
              </View>
              <Text className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {shipmentCount > 0 ? `${shipmentCount} total batch(es) registered` : 'Create a batch in Company Portal to start multi-box scanning'}
              </Text>
            </View>

            {/* Company Direct Navigation Cards */}
            <View className="flex-row gap-2.5 mb-2.5">
              {/* Shipment Analytics with Real GPS */}
              <Pressable
                onPress={() => router.push('/company/analytics' as any)}
                className="flex-1 bg-zinc-50 dark:bg-[#121216] p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 active:opacity-80"
              >
                <View className="w-10 h-10 rounded-xl bg-blue-500/10 items-center justify-center mb-2.5">
                  <BarChart3 size={20} color="#3B82F6" />
                </View>
                <Text className="text-sm font-bold text-black dark:text-white">Route Analytics</Text>
                <Text className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Corridor routing and weather-based transit simulation
                </Text>
              </Pressable>

              {/* Dispatch Window Optimizer */}
              <Pressable
                onPress={() => router.push('/company/dispatch' as any)}
                className="flex-1 bg-zinc-50 dark:bg-[#121216] p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 active:opacity-80"
              >
                <View className="w-10 h-10 rounded-xl bg-amber-500/10 items-center justify-center mb-2.5">
                  <CalendarCheck size={20} color="#F59E0B" />
                </View>
                <Text className="text-sm font-bold text-black dark:text-white">Dispatch Optimizer</Text>
                <Text className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Forecast multi-day weather windows to minimize dispatch risk
                </Text>
              </Pressable>
            </View>

            {/* Manage Shipments Full Button */}
            <Pressable
              onPress={() => router.push('/company/shipments' as any)}
              className="bg-zinc-50 dark:bg-[#121216] p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex-row items-center justify-between active:opacity-80"
            >
              <View className="flex-row items-center gap-3 flex-1 pr-2">
                <View className="w-8 h-8 rounded-lg bg-emerald-500/10 items-center justify-center">
                  <PlusCircle size={18} color="#10B981" />
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-bold text-black dark:text-white">Shipment Management</Text>
                  <Text className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5" numberOfLines={2}>
                    Manage batches, inspect packages, and track delivery conditions
                  </Text>
                </View>
              </View>
              <ArrowRight size={16} color="#71717A" />
            </Pressable>
          </View>
        )}

        {/* ========================================================================= */}
        {/* HOW THE SYSTEM WORKS (EXPLANATION IN HOME SCREEN)                         */}
        {/* ========================================================================= */}
        <View className="mb-6">
          <Text className="text-xl font-bold text-black dark:text-white mb-1">
            How Inspectify Works
          </Text>
          <Text className="text-xs text-zinc-500 dark:text-zinc-400 mb-3.5">
            Three-step verification process for packages and contents
          </Text>

          <View className="gap-2.5">
            {/* Step 1 */}
            <View className="bg-zinc-50 dark:bg-[#121216] p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex-row items-center gap-3.5">
              <View className="w-8 h-8 rounded-full bg-[#FF2D55] items-center justify-center">
                <Text className="text-white text-sm font-bold">1</Text>
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-black dark:text-white">
                  Visual Surface Inspection
                </Text>
                <Text className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Detects packaging tears, crushed box corners, punctures, and display scratches.
                </Text>
              </View>
            </View>

            {/* Step 2 */}
            <View className="bg-zinc-50 dark:bg-[#121216] p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex-row items-center gap-3.5">
              <View className="w-8 h-8 rounded-full bg-[#FF2D55] items-center justify-center">
                <Text className="text-white text-sm font-bold">2</Text>
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-black dark:text-white">
                  Transit Condition Analysis
                </Text>
                <Text className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Evaluates route distance, transit conditions, and weather exposure factors.
                </Text>
              </View>
            </View>

            {/* Step 3 */}
            <View className="bg-zinc-50 dark:bg-[#121216] p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex-row items-center gap-3.5">
              <View className="w-8 h-8 rounded-full bg-[#FF2D55] items-center justify-center">
                <Text className="text-white text-sm font-bold">3</Text>
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-black dark:text-white">
                  Damage Risk Prediction
                </Text>
                <Text className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Calculates structural packaging risk and verifies internal content preservation.
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Recent Scans (Personal Recipient Accounts Only) */}
        {!isCompany && recentScans.length > 0 && (
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
