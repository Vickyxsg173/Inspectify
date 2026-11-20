import { ThemeToggle } from '@/components/ThemeToggle';
import { BACKEND_URL } from '@/constants/api';
import {
  AVAILABLE_MODELS,
  DetectionModelId,
  getSelectedModel,
  saveSelectedModel,
} from '@/utils/modelStorage';
import {
  DEFAULT_THRESHOLDS,
  getConfidenceThresholds,
  saveConfidenceThresholds,
} from '@/utils/confidenceStorage';
import { getProfileData, saveProfileData } from '@/utils/profileStorage';
import {
  clearScanHistory,
  deleteScan,
  formatRelativeTime,
  getScanHistory,
  isAutoSaveEnabled,
  ScanRecord,
  setAutoSaveSetting,
} from '@/utils/scanStorage';
import LiquidGlassSlider from '@/components/LiquidGlassSlider';
import * as ImagePicker from 'expo-image-picker';
import {
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Edit3,
  History,
  Layers,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Smartphone,
  Trash2,
  User,
  Video,
  X,
  Info,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

type ActiveTab = 'preferences' | 'history';
type HistoryFilter = 'all' | 'defective' | 'intact';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, session, accountType, companyName, signOut } = useAuth();
  const isCompany = accountType === 'company';
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [activeTab, setActiveTab] = useState<ActiveTab>('preferences');

  // Profile State
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [profileName, setProfileName] = useState('Ishant Sharma');
  const [profileRole, setProfileRole] = useState('Quality Assurance Lead');
  const [isEditingName, setIsEditingName] = useState(false);

  // Settings State
  const [selectedModel, setSelectedModel] = useState<DetectionModelId>('best');
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [threshBest, setThreshBest] = useState<number>(DEFAULT_THRESHOLDS.best);
  const [threshLatest, setThreshLatest] = useState<number>(DEFAULT_THRESHOLDS.latest);
  const [threshScreen, setThreshScreen] = useState<number>(DEFAULT_THRESHOLDS.screen);
  const [threshVideoBox, setThreshVideoBox] = useState<number>(DEFAULT_THRESHOLDS.videoBox);
  const [savedBanner, setSavedBanner] = useState<string | null>(null);
  const [autoSave, setAutoSave] = useState(true);
  const [highPrecision, setHighPrecision] = useState(false);

  // History State
  const [historyList, setHistoryList] = useState<ScanRecord[]>([]);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  const [selectedScan, setSelectedScan] = useState<ScanRecord | null>(null);

  const loadData = async () => {
    const profile = await getProfileData();
    setProfileName(profile.name);
    setProfileRole(profile.role);

    const autoSaveStatus = await isAutoSaveEnabled();
    setAutoSave(autoSaveStatus);

    const modelChoice = await getSelectedModel();
    setSelectedModel(modelChoice);

    const thresholds = await getConfidenceThresholds();
    setThreshBest(thresholds.best);
    setThreshLatest(thresholds.latest);
    setThreshScreen(thresholds.screen);
    setThreshVideoBox(thresholds.videoBox);

    const history = await getScanHistory();
    setHistoryList(history);
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const handleModelChange = async (modelId: DetectionModelId) => {
    setSelectedModel(modelId);
    setModelDropdownOpen(false);
    await saveSelectedModel(modelId);
  };

  const handleThresholdChange = async (
    key: 'best' | 'latest' | 'screen' | 'videoBox',
    value: number
  ) => {
    const rounded = Math.round(value * 100) / 100;
    const next = {
      best: threshBest,
      latest: threshLatest,
      screen: threshScreen,
      videoBox: threshVideoBox,
      [key]: rounded,
    };
    if (key === 'best') setThreshBest(rounded);
    else if (key === 'latest') setThreshLatest(rounded);
    else if (key === 'screen') setThreshScreen(rounded);
    else if (key === 'videoBox') setThreshVideoBox(rounded);
    await saveConfidenceThresholds(next);
  };

  const handleResetToDefaults = async () => {
    setThreshBest(DEFAULT_THRESHOLDS.best);
    setThreshLatest(DEFAULT_THRESHOLDS.latest);
    setThreshScreen(DEFAULT_THRESHOLDS.screen);
    setThreshVideoBox(DEFAULT_THRESHOLDS.videoBox);
    await saveConfidenceThresholds(DEFAULT_THRESHOLDS);
    setSavedBanner('Reset all thresholds to calibrated defaults');
    setTimeout(() => setSavedBanner(null), 3000);
  };

  const handleAutoSaveChange = async (val: boolean) => {
    setAutoSave(val);
    await setAutoSaveSetting(val);
  };

  const handleSaveName = async () => {
    setIsEditingName(false);
    await saveProfileData(profileName, profileRole);
  };

  const pickProfileImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled && result.assets[0].uri) {
      setProfileImage(result.assets[0].uri);
    }
  };

  const handleDeleteScan = async (id: string) => {
    await deleteScan(id);
    const updated = await getScanHistory();
    setHistoryList(updated);
    if (selectedScan?.id === id) setSelectedScan(null);
  };

  const handleClearAllHistory = () => {
    Alert.alert(
      'Clear Scan History',
      'Are you sure you want to delete all saved scan records? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await clearScanHistory();
            setHistoryList([]);
          },
        },
      ]
    );
  };

  const filteredHistory = historyList.filter((scan) => {
    if (historyFilter === 'defective') return scan.status.toUpperCase() === 'DEFECTIVE';
    if (historyFilter === 'intact') return scan.status.toUpperCase() === 'INTACT';
    return true;
  });

  const defectCount = historyList.filter((s) => s.status.toUpperCase() === 'DEFECTIVE').length;
  const intactCount = historyList.filter((s) => s.status.toUpperCase() === 'INTACT').length;
  const activeModelInfo = AVAILABLE_MODELS.find((m) => m.id === selectedModel) || AVAILABLE_MODELS[0];

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black">
      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View className="flex-row justify-between items-center py-5">
          <View>
            <Text className="text-3xl font-black text-black dark:text-white tracking-tight">
              Settings
            </Text>
            <Text className="text-zinc-500 dark:text-zinc-400 font-medium text-sm mt-0.5">
              Preferences & Configuration
            </Text>
          </View>
          <ThemeToggle />
        </View>

        {/* Tab Switcher: Only show History tab for personal accounts (Enterprise saves directly to shipments) */}
        {!isCompany ? (
          <View className="flex-row bg-zinc-100 dark:bg-[#16161A] p-1.5 rounded-2xl mb-6 border border-zinc-200/80 dark:border-zinc-800">
            <Pressable
              onPress={() => setActiveTab('preferences')}
              className={`flex-1 py-2.5 rounded-xl items-center flex-row justify-center gap-2 ${
                activeTab === 'preferences'
                  ? 'bg-white dark:bg-[#222226] shadow-sm'
                  : ''
              }`}
            >
              <Settings
                size={16}
                color={activeTab === 'preferences' ? '#FF2D55' : '#71717A'}
              />
              <Text
                className={`text-sm font-bold ${
                  activeTab === 'preferences'
                    ? 'text-black dark:text-white'
                    : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                Preferences
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab('history')}
              className={`flex-1 py-2.5 rounded-xl items-center flex-row justify-center gap-2 ${
                activeTab === 'history'
                  ? 'bg-white dark:bg-[#222226] shadow-sm'
                  : ''
              }`}
            >
              <History
                size={16}
                color={activeTab === 'history' ? '#FF2D55' : '#71717A'}
              />
              <Text
                className={`text-sm font-bold ${
                  activeTab === 'history'
                    ? 'text-black dark:text-white'
                    : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                History {historyList.length > 0 ? `(${historyList.length})` : ''}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* ================= TAB 1: PREFERENCES ================= */}
        {activeTab === 'preferences' || isCompany ? (
          <>
            {/* Profile Section */}
            <View className="mb-6">
              <View className="bg-white dark:bg-[#111114] rounded-3xl p-5 shadow-sm border border-zinc-200/80 dark:border-zinc-800">
                <View className="flex-row items-center gap-4">
                  <Pressable onPress={pickProfileImage} className="relative">
                    <View className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 border-2 border-[#FF2D55]/30 overflow-hidden items-center justify-center">
                      {profileImage ? (
                        <Image source={{ uri: profileImage }} className="w-full h-full" />
                      ) : (
                        <User size={30} color={isCompany ? '#3B82F6' : '#FF2D55'} />
                      )}
                    </View>
                    <View className="absolute bottom-0 right-0 bg-[#FF2D55] w-5 h-5 rounded-full items-center justify-center border-2 border-white dark:border-[#111114]">
                      <Camera size={10} color="#FFFFFF" />
                    </View>
                  </Pressable>

                  <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-lg font-black text-black dark:text-white" numberOfLines={1}>
                        {companyName || user?.email?.split('@')[0] || profileName}
                      </Text>
                      <View className="bg-[#FF2D55]/10 px-2 py-0.5 rounded-md">
                        <Text className="text-[10px] font-black text-[#FF2D55] uppercase">
                          {isCompany ? 'ENTERPRISE' : 'PERSONAL'}
                        </Text>
                      </View>
                    </View>
                    <Text className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5" numberOfLines={1}>
                      {user?.email}
                    </Text>
                  </View>
                </View>

                {/* Account info and logout */}
                <View className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex-row gap-2">
                  {isCompany && (
                    <Pressable
                      onPress={() => router.push('/company/dashboard' as any)}
                      className="flex-1 bg-red-500 py-2.5 rounded-xl items-center"
                    >
                      <Text className="text-white font-bold text-xs">Company Portal</Text>
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() => signOut().then(() => router.replace('/auth/login' as any))}
                    className="flex-1 bg-zinc-100 dark:bg-zinc-800 py-2.5 rounded-xl items-center border border-zinc-200 dark:border-zinc-700"
                  >
                    <Text className="text-zinc-700 dark:text-zinc-300 font-bold text-xs">Sign Out</Text>
                  </Pressable>
                </View>
              </View>
            </View>

            {/* Model Adjustments & Auto-Save */}
            <View className="mb-6">
              <View className="flex-row items-center gap-2.5 mb-3.5">
                <Sliders size={20} color="#FF2D55" />
                <Text className="text-xl font-black text-black dark:text-white">
                  Model Adjustments
                </Text>
              </View>

              <View className="bg-white dark:bg-[#111114] rounded-3xl p-5 shadow-sm border border-zinc-200/80 dark:border-zinc-800">
                {/* Active Detection Model Dropdown */}
                <View className="mb-6 relative z-30">
                  <View className="flex-row justify-between items-center mb-2">
                    <View className="flex-row items-center gap-2">
                      <Layers size={16} color="#FF2D55" />
                      <Text className="text-black dark:text-white font-bold text-sm">
                        Defect Detection Model
                      </Text>
                    </View>
                    <View className="bg-[#FF2D55]/10 px-2.5 py-0.5 rounded-full border border-[#FF2D55]/20">
                      <Text className="text-[11px] font-black text-[#FF2D55]">
                        {activeModelInfo.badge}
                      </Text>
                    </View>
                  </View>

                  <Pressable
                    onPress={() => setModelDropdownOpen(!modelDropdownOpen)}
                    className="bg-zinc-50 dark:bg-zinc-900 p-4 rounded-xl flex-row justify-between items-center border border-zinc-200 dark:border-zinc-800 active:opacity-90"
                  >
                    <View className="flex-1 pr-2">
                      <Text className="text-black dark:text-white font-bold text-base">
                        {activeModelInfo.name}
                      </Text>
                      <Text className="text-zinc-500 dark:text-zinc-400 text-xs mt-0.5 font-mono">
                        {activeModelInfo.fileName}
                      </Text>
                    </View>
                    <ChevronRight
                      size={20}
                      color="#FF2D55"
                      style={{ transform: [{ rotate: modelDropdownOpen ? '90deg' : '0deg' }] }}
                    />
                  </Pressable>

                  {modelDropdownOpen && (
                    <View className="absolute top-[82px] left-0 right-0 bg-white dark:bg-[#16161A] rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 z-50 overflow-hidden">
                      {AVAILABLE_MODELS.map((modelOpt) => {
                        const isSelected = selectedModel === modelOpt.id;
                        return (
                          <Pressable
                            key={modelOpt.id}
                            onPress={() => handleModelChange(modelOpt.id)}
                            className={`p-4 border-b border-zinc-100 dark:border-zinc-800/60 active:bg-zinc-50 dark:active:bg-zinc-800 flex-row items-center justify-between ${
                              isSelected ? 'bg-[#FF2D55]/10' : ''
                            }`}
                          >
                            <View className="flex-1 pr-3">
                              <View className="flex-row items-center gap-2 mb-1">
                                <Text
                                  className={`font-bold ${
                                    isSelected
                                      ? 'text-[#FF2D55] font-black'
                                      : 'text-zinc-800 dark:text-zinc-200'
                                  }`}
                                >
                                  {modelOpt.name}
                                </Text>
                                <View className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                                  <Text className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-300">
                                    {modelOpt.badge}
                                  </Text>
                                </View>
                              </View>
                              <Text className="text-xs text-zinc-500 dark:text-zinc-400">
                                {modelOpt.description}
                              </Text>
                              <Text className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500 mt-0.5">
                                Weights: {modelOpt.fileName}
                              </Text>
                            </View>
                            {isSelected && <Check size={18} color="#FF2D55" />}
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </View>

                {/* ── Confidence Thresholds ─────────────────────────── */}
                <View style={{ marginBottom: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: isDark ? '#27272A' : '#E4E4E7' }}>
                  {/* Header row */}
                  <View className="flex-row justify-between items-center mb-3">
                    <View className="flex-1 pr-2">
                      <Text className="text-black dark:text-white font-bold text-sm">
                        Confidence Thresholds
                      </Text>
                      <Text className="text-zinc-500 dark:text-zinc-400 text-xs">
                        Slide to adjust • defaults are pre-calibrated
                      </Text>
                    </View>
                    <Pressable
                      onPress={handleResetToDefaults}
                      className="bg-red-500/10 border border-red-500/25 px-2.5 py-1.5 rounded-lg active:opacity-75"
                    >
                      <Text className="text-xs font-bold text-[#FF2D55]">Reset All</Text>
                    </Pressable>
                  </View>

                  {savedBanner && (
                    <View className="bg-[#FF2D55]/10 border border-[#FF2D55]/30 p-2.5 rounded-xl mb-3 flex-row items-center gap-2">
                      <CheckCircle2 size={16} color="#FF2D55" />
                      <Text className="text-xs font-bold text-[#FF2D55]">{savedBanner}</Text>
                    </View>
                  )}

                  {/* ── Liquid Glass Card ─────────────────────────────── */}
                  <View style={{
                    borderRadius: 20,
                    overflow: 'hidden',
                    backgroundColor: isDark ? 'rgba(18,18,22,0.85)' : 'rgba(240,240,245,0.85)',
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: isDark ? 0.4 : 0.12,
                    shadowRadius: 18,
                    elevation: 10,
                  }}>
                    {/* Top shimmer stripe */}
                    <View style={{
                      height: 1.5,
                      backgroundColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.80)',
                      marginHorizontal: 20,
                    }} />

                    <View style={{ padding: 18, gap: 20 }}>

                      {/* 1 ── Standard Model (best.pt) ──────────────── */}
                      <View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                          <View style={{
                            width: 28, height: 28, borderRadius: 8,
                            backgroundColor: 'rgba(255,45,85,0.14)',
                            borderWidth: 1, borderColor: 'rgba(255,45,85,0.28)',
                            alignItems: 'center', justifyContent: 'center',
                          }}>
                            <Layers size={15} color="#FF2D55" />
                          </View>
                          <Text style={{ color: isDark ? '#E4E4E7' : '#18181B', fontWeight: '800', fontSize: 13 }}>
                            Standard Model
                          </Text>
                          <View style={{ flex: 1 }} />
                          <View style={{
                            backgroundColor: 'rgba(255,45,85,0.10)', paddingHorizontal: 7, paddingVertical: 2,
                            borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,45,85,0.20)',
                          }}>
                            <Text style={{ fontSize: 10, fontWeight: '700', color: '#FF2D55' }}>best.pt</Text>
                          </View>
                        </View>
                        <LiquidGlassSlider
                          value={threshBest}
                          label="Detection threshold"
                          sublabel="Min confidence to flag a packaging defect"
                          defaultValue={DEFAULT_THRESHOLDS.best}
                          min={0.05} max={0.90} step={0.01}
                          accentColor="#FF2D55"
                          onChange={(v) => handleThresholdChange('best', v)}
                        />
                      </View>

                      {/* Divider */}
                      <View style={{ height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)' }} />

                      {/* 2 ── Latest Multi-Defect Model ──────────────── */}
                      <View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                          <View style={{
                            width: 28, height: 28, borderRadius: 8,
                            backgroundColor: 'rgba(168,85,247,0.14)',
                            borderWidth: 1, borderColor: 'rgba(168,85,247,0.28)',
                            alignItems: 'center', justifyContent: 'center',
                          }}>
                            <Layers size={15} color="#A855F7" />
                          </View>
                          <Text style={{ color: isDark ? '#E4E4E7' : '#18181B', fontWeight: '800', fontSize: 13 }}>
                            Multi-Defect Model
                          </Text>
                          <View style={{ flex: 1 }} />
                          <View style={{
                            backgroundColor: 'rgba(168,85,247,0.10)', paddingHorizontal: 7, paddingVertical: 2,
                            borderRadius: 8, borderWidth: 1, borderColor: 'rgba(168,85,247,0.20)',
                          }}>
                            <Text style={{ fontSize: 10, fontWeight: '700', color: '#A855F7' }}>latest.pt</Text>
                          </View>
                        </View>
                        <LiquidGlassSlider
                          value={threshLatest}
                          label="Detection threshold"
                          sublabel="Min confidence for multi-defect classification"
                          defaultValue={DEFAULT_THRESHOLDS.latest}
                          min={0.05} max={0.90} step={0.01}
                          accentColor="#A855F7"
                          onChange={(v) => handleThresholdChange('latest', v)}
                        />
                      </View>

                      {/* Divider */}
                      <View style={{ height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)' }} />

                      {/* 3 ── Screen Scratch Model ───────────────────── */}
                      <View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                          <View style={{
                            width: 28, height: 28, borderRadius: 8,
                            backgroundColor: 'rgba(6,182,212,0.14)',
                            borderWidth: 1, borderColor: 'rgba(6,182,212,0.28)',
                            alignItems: 'center', justifyContent: 'center',
                          }}>
                            <Smartphone size={15} color="#06B6D4" />
                          </View>
                          <Text style={{ color: isDark ? '#E4E4E7' : '#18181B', fontWeight: '800', fontSize: 13 }}>
                            Screen Scratch Model
                          </Text>
                          <View style={{ flex: 1 }} />
                          <View style={{
                            backgroundColor: 'rgba(6,182,212,0.10)', paddingHorizontal: 7, paddingVertical: 2,
                            borderRadius: 8, borderWidth: 1, borderColor: 'rgba(6,182,212,0.20)',
                          }}>
                            <Text style={{ fontSize: 10, fontWeight: '700', color: '#06B6D4' }}>screen.pt</Text>
                          </View>
                        </View>
                        <LiquidGlassSlider
                          value={threshScreen}
                          label="Detection threshold"
                          sublabel="Hairline scratches score 6-10% — keep below 10%"
                          defaultValue={DEFAULT_THRESHOLDS.screen}
                          min={0.03} max={0.30} step={0.01}
                          accentColor="#06B6D4"
                          onChange={(v) => handleThresholdChange('screen', v)}
                        />
                      </View>

                      {/* Divider */}
                      <View style={{ height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)' }} />

                      {/* 4 ── Video Bounding Box Display Threshold ───── */}
                      <View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                          <View style={{
                            width: 28, height: 28, borderRadius: 8,
                            backgroundColor: 'rgba(251,146,60,0.14)',
                            borderWidth: 1, borderColor: 'rgba(251,146,60,0.28)',
                            alignItems: 'center', justifyContent: 'center',
                          }}>
                            <Video size={15} color="#FB923C" />
                          </View>
                          <Text style={{ color: isDark ? '#E4E4E7' : '#18181B', fontWeight: '800', fontSize: 13 }}>
                            Video Box Display
                          </Text>
                          <View style={{ flex: 1 }} />
                          <View style={{
                            backgroundColor: 'rgba(251,146,60,0.10)', paddingHorizontal: 7, paddingVertical: 2,
                            borderRadius: 8, borderWidth: 1, borderColor: 'rgba(251,146,60,0.20)',
                          }}>
                            <Text style={{ fontSize: 10, fontWeight: '700', color: '#FB923C' }}>Video</Text>
                          </View>
                        </View>
                        <LiquidGlassSlider
                          value={threshVideoBox}
                          label="Min confidence to show bounding box"
                          sublabel="Hides low-confidence boxes in video overlay"
                          defaultValue={DEFAULT_THRESHOLDS.videoBox}
                          min={0.05} max={0.90} step={0.01}
                          accentColor="#FB923C"
                          onChange={(v) => handleThresholdChange('videoBox', v)}
                        />
                      </View>

                    </View>

                    {/* Bottom shimmer stripe */}
                    <View style={{
                      height: 1,
                      backgroundColor: isDark ? 'rgba(0,0,0,0.30)' : 'rgba(0,0,0,0.05)',
                      marginHorizontal: 20,
                    }} />
                  </View>

                  {/* Info note */}
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 10, paddingHorizontal: 4 }}>
                    <Info size={12} color="#52525B" />
                    <Text style={{ fontSize: 10.5, color: '#71717A', flex: 1, lineHeight: 15, fontWeight: '500' }}>
                      Default thresholds are empirically calibrated. Increase to reduce false positives; decrease to catch more subtle defects.
                    </Text>
                  </View>
                </View>

                {/* History Auto-Save Setting: Only relevant for Personal accounts */}
                {!isCompany && (
                  <View className="flex-row justify-between items-center py-3 border-t border-zinc-100 dark:border-zinc-800">
                    <View className="flex-1 pr-4">
                      <Text className="text-black dark:text-white font-bold text-sm">
                        Auto-Save Scans to History
                      </Text>
                      <Text className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        Toggle to automatically save or stop saving scans in the History tab
                      </Text>
                    </View>
                    <Switch
                      value={autoSave}
                      onValueChange={handleAutoSaveChange}
                      trackColor={{ false: '#71717A', true: '#FF2D55' }}
                    />
                  </View>
                )}

                {isCompany && (
                  <View className="py-2.5 px-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 flex-row items-center gap-2">
                    <Info size={16} color="#3B82F6" />
                    <Text className="text-xs text-zinc-500 dark:text-zinc-400 flex-1">
                      Enterprise Account: Package and screen scans automatically sync into active shipments.
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </>
        ) : (
          /* ================= TAB 2: HISTORY (Personal Only) ================= */
          <View>
            {/* Filter Chips & Clear All */}
            <View className="flex-row justify-between items-center mb-4">
              <View className="flex-row gap-2">
                <Pressable
                  onPress={() => setHistoryFilter('all')}
                  className={`px-3 py-1.5 rounded-full border ${
                    historyFilter === 'all'
                      ? 'bg-[#FF2D55] border-[#FF2D55]'
                      : 'bg-zinc-100 dark:bg-[#16161A] border-zinc-200 dark:border-zinc-800'
                  }`}
                >
                  <Text className={`text-xs font-bold ${historyFilter === 'all' ? 'text-white' : 'text-zinc-600 dark:text-zinc-400'}`}>
                    All ({historyList.length})
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setHistoryFilter('defective')}
                  className={`px-3 py-1.5 rounded-full border ${
                    historyFilter === 'defective'
                      ? 'bg-[#FF2D55] border-[#FF2D55]'
                      : 'bg-zinc-100 dark:bg-[#16161A] border-zinc-200 dark:border-zinc-800'
                  }`}
                >
                  <Text className={`text-xs font-bold ${historyFilter === 'defective' ? 'text-white' : 'text-zinc-600 dark:text-zinc-400'}`}>
                    Defective ({defectCount})
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setHistoryFilter('intact')}
                  className={`px-3 py-1.5 rounded-full border ${
                    historyFilter === 'intact'
                      ? 'bg-emerald-500 border-emerald-500'
                      : 'bg-zinc-100 dark:bg-[#16161A] border-zinc-200 dark:border-zinc-800'
                  }`}
                >
                  <Text className={`text-xs font-bold ${historyFilter === 'intact' ? 'text-white' : 'text-zinc-600 dark:text-zinc-400'}`}>
                    Passed ({intactCount})
                  </Text>
                </Pressable>
              </View>

              {historyList.length > 0 && (
                <Pressable onPress={handleClearAllHistory} className="p-1">
                  <Text className="text-xs font-bold text-red-500">Clear All</Text>
                </Pressable>
              )}
            </View>

            {/* History Cards List */}
            {filteredHistory.length > 0 ? (
              <View className="gap-2.5">
                {filteredHistory.map((scan) => {
                  const isDefective = scan.status.toUpperCase() === 'DEFECTIVE';
                  return (
                    <Pressable
                      key={scan.id}
                      onPress={() => setSelectedScan(scan)}
                      className="bg-white dark:bg-[#111114] p-3.5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 flex-row items-center justify-between shadow-sm active:bg-zinc-50 dark:active:bg-zinc-900"
                    >
                      <View className="flex-row items-center gap-3.5 flex-1 pr-2">
                        <Image
                          source={{ uri: scan.imageUri }}
                          className="w-14 h-14 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
                          resizeMode="cover"
                        />
                        <View className="flex-1">
                          <Text className="text-sm font-bold text-black dark:text-white" numberOfLines={1}>
                            {scan.title}
                          </Text>
                          <Text className="text-xs text-zinc-400 mt-0.5" numberOfLines={1}>
                            {scan.reason || 'AI Visual QC'}
                          </Text>
                          <Text className="text-[10px] text-zinc-500 font-medium mt-1">
                            {formatRelativeTime(scan.timestamp)}
                          </Text>
                        </View>
                      </View>

                      <View
                        className={`px-2.5 py-1 rounded-full ${
                          isDefective ? 'bg-[#FF2D55]/10' : 'bg-emerald-500/10'
                        }`}
                      >
                        <Text
                          className={`text-xs font-black ${
                            isDefective ? 'text-[#FF2D55]' : 'text-emerald-500'
                          }`}
                        >
                          {isDefective ? 'DEFECT' : 'PASS'}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <View className="bg-zinc-50 dark:bg-[#111114] p-8 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 items-center justify-center">
                <History size={36} color="#FF2D55" />
                <Text className="text-base font-bold text-black dark:text-white mt-3">
                  No Saved Scans
                </Text>
                <Text className="text-xs text-zinc-400 text-center mt-1">
                  {autoSave
                    ? 'All packaging and screen inspections will appear here.'
                    : 'Auto-save is turned off in Preferences. Turn it on to save scan history.'}
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Detail Modal for Selected Scan */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={!!selectedScan}
        onRequestClose={() => setSelectedScan(null)}
      >
        {selectedScan && (
          <View className="flex-1 bg-black/75 items-center justify-center p-6">
            <View className="bg-white dark:bg-[#111114] w-full max-w-sm rounded-3xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-2xl max-h-[85%]">
              <View className="flex-row justify-between items-center mb-3">
                <Text className="text-lg font-black text-black dark:text-white">
                  Scan Details
                </Text>
                <Pressable onPress={() => setSelectedScan(null)} className="p-1">
                  <X size={20} color="#71717A" />
                </Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Full Image */}
                <View className="w-full h-52 rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 mb-4 border border-zinc-200 dark:border-zinc-700">
                  <Image
                    source={{
                      uri: selectedScan.annotatedImage
                        ? `${BACKEND_URL}/uploads/${selectedScan.annotatedImage}`
                        : selectedScan.imageUri,
                    }}
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                </View>

                {/* Status & Confidence */}
                <View className="flex-row justify-between items-center mb-3">
                  <View
                    className={`flex-row items-center gap-1.5 px-3 py-1 rounded-full ${
                      selectedScan.status.toUpperCase() === 'DEFECTIVE'
                        ? 'bg-[#FF2D55]/10 border border-[#FF2D55]/20'
                        : 'bg-zinc-100 dark:bg-zinc-800'
                    }`}
                  >
                    {selectedScan.status.toUpperCase() === 'DEFECTIVE' ? (
                      <ShieldAlert size={14} color="#FF2D55" />
                    ) : (
                      <ShieldCheck size={14} color="#71717A" />
                    )}
                    <Text
                      className={`text-xs font-black ${
                        selectedScan.status.toUpperCase() === 'DEFECTIVE'
                          ? 'text-[#FF2D55]'
                          : 'text-zinc-800 dark:text-zinc-200'
                      }`}
                    >
                      {selectedScan.status.toUpperCase()}
                    </Text>
                  </View>

                  <Text className="text-xs font-bold text-zinc-600 dark:text-zinc-300">
                    Confidence: {(selectedScan.confidence * 100).toFixed(1)}%
                  </Text>
                </View>

                {/* Findings */}
                <View className="bg-zinc-50 dark:bg-zinc-900 p-3.5 rounded-2xl mb-4 border border-zinc-200/80 dark:border-zinc-800">
                  <Text className="text-xs font-black text-[#FF2D55] uppercase tracking-wider mb-1">AI Inspection Summary</Text>
                  <Text className="text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed font-medium">
                    {selectedScan.reason || 'No description available.'}
                  </Text>
                  <Text className="text-[10px] text-zinc-400 mt-2">
                    Scanned {new Date(selectedScan.timestamp).toLocaleString()}
                  </Text>
                </View>

                {/* Delete button */}
                <Pressable
                  onPress={() => handleDeleteScan(selectedScan.id)}
                  className="bg-[#FF2D55]/10 border border-[#FF2D55]/30 py-3 rounded-xl flex-row items-center justify-center gap-2"
                >
                  <Trash2 size={16} color="#FF2D55" />
                  <Text className="text-[#FF2D55] font-bold text-xs">
                    Delete Record
                  </Text>
                </Pressable>
              </ScrollView>
            </View>
          </View>
        )}
      </Modal>
    </SafeAreaView>
  );
}
