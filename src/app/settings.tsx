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
import Slider from '@react-native-community/slider';
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
  Trash2,
  User,
  X,
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
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type ActiveTab = 'preferences' | 'history';
type HistoryFilter = 'all' | 'defective' | 'intact';

export default function SettingsScreen() {
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

  const handleThresholdChange = async (modelKey: 'best' | 'latest', value: number) => {
    const rounded = Math.round(value * 100) / 100;
    if (modelKey === 'best') {
      setThreshBest(rounded);
      await saveConfidenceThresholds({ best: rounded, latest: threshLatest });
    } else {
      setThreshLatest(rounded);
      await saveConfidenceThresholds({ best: threshBest, latest: rounded });
    }
  };

  const handleResetToDefaults = async () => {
    setThreshBest(DEFAULT_THRESHOLDS.best);
    setThreshLatest(DEFAULT_THRESHOLDS.latest);
    await saveConfidenceThresholds(DEFAULT_THRESHOLDS);
    setSavedBanner('Reset to calibrated optimum thresholds (12% / 25%)');
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
              Preferences & Scan History
            </Text>
          </View>
          <ThemeToggle />
        </View>

        {/* Tab Switcher: Preferences vs History */}
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

        {/* ================= TAB 1: PREFERENCES ================= */}
        {activeTab === 'preferences' ? (
          <>
            {/* User Profile Card */}
            <View className="bg-white dark:bg-[#111114] rounded-3xl p-6 mb-6 shadow-sm border border-zinc-200/80 dark:border-zinc-800">
              <View className="items-center mb-6">
                <Pressable onPress={pickProfileImage} className="relative">
                  <View className="w-24 h-24 rounded-full bg-zinc-100 dark:bg-zinc-900 items-center justify-center overflow-hidden border-2 border-[#FF2D55]/30">
                    {profileImage ? (
                      <Image source={{ uri: profileImage }} className="w-full h-full" />
                    ) : (
                      <User size={44} color="#FF2D55" />
                    )}
                  </View>
                  <View className="absolute bottom-0 right-0 bg-[#FF2D55] p-2 rounded-full border-2 border-white dark:border-[#111114]">
                    <Camera size={14} color="#FFFFFF" />
                  </View>
                </Pressable>

                {/* Editable Profile Name */}
                {isEditingName ? (
                  <View className="flex-row items-center gap-2 mt-4">
                    <TextInput
                      value={profileName}
                      onChangeText={setProfileName}
                      autoFocus
                      placeholder="Your Name"
                      placeholderTextColor="#71717A"
                      className="bg-zinc-100 dark:bg-zinc-800 text-lg font-bold text-black dark:text-white px-3 py-1.5 rounded-xl border border-[#FF2D55]/50 min-w-[200px] text-center"
                    />
                    <Pressable
                      onPress={handleSaveName}
                      className="bg-[#FF2D55] p-2 rounded-xl"
                    >
                      <Check size={18} color="#FFFFFF" />
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => setIsEditingName(true)}
                    className="flex-row items-center gap-2 mt-3.5 px-3 py-1 rounded-xl active:bg-zinc-100 dark:active:bg-zinc-800"
                  >
                    <Text className="text-xl font-black text-black dark:text-white">
                      {profileName}
                    </Text>
                    <Edit3 size={15} color="#FF2D55" />
                  </Pressable>
                )}

                <Text className="text-zinc-500 dark:text-zinc-400 text-xs mt-1 font-medium">{profileRole}</Text>
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

              <View className="bg-white dark:bg-[#111114] rounded-3xl p-6 shadow-sm border border-zinc-200/80 dark:border-zinc-800">
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
                  <Text className="text-zinc-500 dark:text-zinc-400 text-xs mt-2">
                    Switch models to test performance. Seamlessly falls back to standard model if an error occurs.
                  </Text>
                </View>

                {/* Confidence Thresholds For Both Models */}
                <View className="mb-6 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                  <View className="flex-row justify-between items-center mb-3">
                    <View>
                      <Text className="text-black dark:text-white font-bold text-base">
                        Model Confidence Thresholds
                      </Text>
                      <Text className="text-zinc-500 dark:text-zinc-400 text-xs mt-0.5">
                        Controls detection sensitivity. Directly alters scan & live stream output.
                      </Text>
                    </View>
                    <Pressable
                      onPress={handleResetToDefaults}
                      className="bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-lg active:opacity-70"
                    >
                      <Text className="text-xs font-bold text-[#FF2D55]">Reset Defaults</Text>
                    </Pressable>
                  </View>

                  {savedBanner && (
                    <View className="bg-[#FF2D55]/10 border border-[#FF2D55]/30 p-2.5 rounded-xl mb-3 flex-row items-center gap-2">
                      <CheckCircle2 size={16} color="#FF2D55" />
                      <Text className="text-xs font-bold text-[#FF2D55]">{savedBanner}</Text>
                    </View>
                  )}

                  {/* 1. Standard Model (best.pt) Threshold Slider */}
                  <View className="bg-zinc-50 dark:bg-zinc-900/70 p-4 rounded-2xl mb-3.5 border border-zinc-200/80 dark:border-zinc-800">
                    <View className="flex-row justify-between items-center mb-1">
                      <View className="flex-row items-center gap-2">
                        <Text className="text-black dark:text-white font-bold text-sm">
                          Standard Model (best.pt)
                        </Text>
                        {selectedModel === 'best' && (
                          <View className="bg-[#FF2D55] px-2 py-0.5 rounded-md">
                            <Text className="text-[10px] font-black text-white">ACTIVE</Text>
                          </View>
                        )}
                      </View>
                      <Text className="text-[#FF2D55] font-black text-base">
                        {(threshBest * 100).toFixed(0)}%
                      </Text>
                    </View>

                    <Slider
                      style={{ width: '100%', height: 36 }}
                      minimumValue={0.05}
                      maximumValue={0.80}
                      step={0.01}
                      value={threshBest}
                      onValueChange={(val) => handleThresholdChange('best', val)}
                      minimumTrackTintColor="#FF2D55"
                      maximumTrackTintColor="#E4E4E7"
                      thumbTintColor="#FF2D55"
                    />

                    <View className="flex-row justify-between items-center mt-1">
                      <Text className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        Higher Recall (5%)
                      </Text>
                      <View className="bg-[#FF2D55]/10 px-2 py-0.5 rounded-md border border-[#FF2D55]/20">
                        <Text className="text-[10px] font-bold text-[#FF2D55]">
                          Optimum: 12% (Fine Creases)
                        </Text>
                      </View>
                      <Text className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        Strict (80%)
                      </Text>
                    </View>
                  </View>

                  {/* 2. Latest Defect Model (latest_model_defect.pt) Threshold Slider */}
                  <View className="bg-zinc-50 dark:bg-zinc-900/70 p-4 rounded-2xl mb-2 border border-zinc-200/80 dark:border-zinc-800">
                    <View className="flex-row justify-between items-center mb-1">
                      <View className="flex-row items-center gap-2">
                        <Text className="text-black dark:text-white font-bold text-sm">
                          Latest Defect Model (latest_model_defect.pt)
                        </Text>
                        {selectedModel === 'latest' && (
                          <View className="bg-[#FF2D55] px-2 py-0.5 rounded-md">
                            <Text className="text-[10px] font-black text-white">ACTIVE</Text>
                          </View>
                        )}
                      </View>
                      <Text className="text-[#FF2D55] font-black text-base">
                        {(threshLatest * 100).toFixed(0)}%
                      </Text>
                    </View>

                    <Slider
                      style={{ width: '100%', height: 36 }}
                      minimumValue={0.05}
                      maximumValue={0.80}
                      step={0.01}
                      value={threshLatest}
                      onValueChange={(val) => handleThresholdChange('latest', val)}
                      minimumTrackTintColor="#FF2D55"
                      maximumTrackTintColor="#E4E4E7"
                      thumbTintColor="#FF2D55"
                    />

                    <View className="flex-row justify-between items-center mt-1">
                      <Text className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        Higher Recall (5%)
                      </Text>
                      <View className="bg-[#FF2D55]/10 px-2 py-0.5 rounded-md border border-[#FF2D55]/20">
                        <Text className="text-[10px] font-bold text-[#FF2D55]">
                          Optimum: 25% (Corner Crush)
                        </Text>
                      </View>
                      <Text className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        Strict (80%)
                      </Text>
                    </View>
                  </View>

                  <Text className="text-zinc-500 dark:text-zinc-400 text-xs mt-2 leading-relaxed">
                    Tip for fine damage: Subtle corner creases and small paper tears generate lower confidence scores (~13-36%). Use calibrated defaults (12% for Standard, 25% for Latest) so finely damaged boxes are correctly flagged as DEFECTIVE.
                  </Text>
                </View>

                {/* Auto-Save Toggle */}
                <View className="flex-row justify-between items-center py-3.5 border-t border-zinc-100 dark:border-zinc-800">
                  <View className="flex-1 pr-4">
                    <Text className="text-black dark:text-white font-bold text-sm">
                      Auto-save Scans
                    </Text>
                    <Text className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Saves every defect scan to your local History tab
                    </Text>
                  </View>
                  <Switch
                    value={autoSave}
                    onValueChange={handleAutoSaveChange}
                    trackColor={{ false: '#71717A', true: '#FF2D55' }}
                  />
                </View>

                {/* High Precision Mode */}
                <View className="flex-row justify-between items-center py-3.5 border-t border-zinc-100 dark:border-zinc-800">
                  <Text className="text-black dark:text-white font-bold text-sm">
                    High Precision Mode
                  </Text>
                  <Switch
                    value={highPrecision}
                    onValueChange={setHighPrecision}
                    trackColor={{ false: '#71717A', true: '#FF2D55' }}
                  />
                </View>
              </View>
            </View>

          </>
        ) : (
          /* ================= TAB 2: SCAN HISTORY ================= */
          <View className="mb-8">
            {/* Filter Pills & Stats */}
            <View className="flex-row justify-between items-center mb-4">
              <View className="flex-row gap-2">
                <Pressable
                  onPress={() => setHistoryFilter('all')}
                  className={`px-3.5 py-1.5 rounded-full ${
                    historyFilter === 'all'
                      ? 'bg-[#FF2D55]'
                      : 'bg-zinc-100 dark:bg-zinc-800'
                  }`}
                >
                  <Text
                    className={`text-xs font-black ${
                      historyFilter === 'all'
                        ? 'text-white'
                        : 'text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    All ({historyList.length})
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setHistoryFilter('defective')}
                  className={`px-3.5 py-1.5 rounded-full ${
                    historyFilter === 'defective'
                      ? 'bg-[#FF2D55]'
                      : 'bg-zinc-100 dark:bg-zinc-800'
                  }`}
                >
                  <Text
                    className={`text-xs font-black ${
                      historyFilter === 'defective'
                        ? 'text-white'
                        : 'text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    Defects ({defectCount})
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setHistoryFilter('intact')}
                  className={`px-3.5 py-1.5 rounded-full ${
                    historyFilter === 'intact'
                      ? 'bg-black dark:bg-white'
                      : 'bg-zinc-100 dark:bg-zinc-800'
                  }`}
                >
                  <Text
                    className={`text-xs font-black ${
                      historyFilter === 'intact'
                        ? 'text-white dark:text-black'
                        : 'text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    Intact ({intactCount})
                  </Text>
                </Pressable>
              </View>

              {historyList.length > 0 ? (
                <Pressable
                  onPress={handleClearAllHistory}
                  className="p-2 rounded-xl active:bg-zinc-100 dark:active:bg-zinc-800"
                >
                  <Trash2 size={18} color="#FF2D55" />
                </Pressable>
              ) : null}
            </View>

            {/* Scan History Items */}
            {filteredHistory.length > 0 ? (
              filteredHistory.map((scan) => {
                const isDefect = scan.status.toUpperCase() === 'DEFECTIVE';
                const imageSrc = scan.annotatedImage
                  ? `${BACKEND_URL}/uploads/${scan.annotatedImage}`
                  : scan.imageUri;

                return (
                  <Pressable
                    key={scan.id}
                    onPress={() => setSelectedScan(scan)}
                    className="bg-white dark:bg-[#111114] p-4 rounded-2xl mb-3 border border-zinc-200/80 dark:border-zinc-800 shadow-sm active:opacity-90"
                  >
                    <View className="flex-row items-center gap-3.5">
                      {/* Image Thumbnail */}
                      <View className="w-16 h-16 rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                        {imageSrc ? (
                          <Image
                            source={{ uri: imageSrc }}
                            className="w-full h-full"
                            resizeMode="cover"
                          />
                        ) : (
                          <View className="w-full h-full items-center justify-center">
                            <Layers size={20} color="#71717A" />
                          </View>
                        )}
                      </View>

                      {/* Content */}
                      <View className="flex-1">
                        <View className="flex-row items-center justify-between mb-1">
                          <Text
                            numberOfLines={1}
                            className="font-bold text-base text-black dark:text-white flex-1 pr-2"
                          >
                            {scan.title || (isDefect ? 'Defective Package' : 'Intact Package')}
                          </Text>
                          <View
                            className={`px-2.5 py-0.5 rounded-full ${
                              isDefect
                                ? 'bg-[#FF2D55]/10 border border-[#FF2D55]/20'
                                : 'bg-zinc-100 dark:bg-zinc-800'
                            }`}
                          >
                            <Text
                              className={`text-[10px] font-black ${
                                isDefect
                                  ? 'text-[#FF2D55]'
                                  : 'text-zinc-800 dark:text-zinc-200'
                              }`}
                            >
                              {isDefect ? 'DEFECT' : 'INTACT'}
                            </Text>
                          </View>
                        </View>

                        <Text
                          numberOfLines={1}
                          className="text-xs text-zinc-500 dark:text-zinc-400 font-medium"
                        >
                          {scan.reason || 'Surface scan completed.'}
                        </Text>

                        <View className="flex-row items-center gap-2 mt-1.5">
                          <Clock size={11} color="#71717A" />
                          <Text className="text-[11px] text-zinc-400 font-semibold">
                            {formatRelativeTime(scan.timestamp)}
                          </Text>
                          <Text className="text-[11px] text-zinc-400">•</Text>
                          <Text className="text-[11px] text-[#FF2D55] font-bold">
                            {(scan.confidence * 100).toFixed(0)}% Confidence
                          </Text>
                        </View>
                      </View>
                    </View>
                  </Pressable>
                );
              })
            ) : (
              <View className="bg-zinc-50 dark:bg-[#111114] p-8 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 items-center justify-center">
                <History size={36} color="#FF2D55" />
                <Text className="text-base font-bold text-black dark:text-white mt-3">
                  No Saved Scans
                </Text>
                <Text className="text-xs text-zinc-400 text-center mt-1">
                  When auto-save is enabled, all your AI quality inspections will be saved here automatically.
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
