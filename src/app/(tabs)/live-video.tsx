import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, CameraType } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { useVideoPlayer, VideoView } from 'expo-video';
import {
  Camera,
  Flashlight,
  FlashlightOff,
  RefreshCw,
  Play,
  Pause,
  AlertTriangle,
  CheckCircle2,
  Scan,
  FileVideo2,
  Upload,
  Share2,
  Download,
  Clock3,
  Video,
  Cctv,
} from 'lucide-react-native';
import { ThemeToggle } from '@/components/ThemeToggle';
import { BACKEND_URL } from '@/constants/api';
import { sendLiveFrame, LiveFrameResult } from '@/services/liveStreamApi';
import {
  getVideoInspectionResults,
  getVideoInspectionStatus,
  uploadVideo,
  VideoInspectionResults,
} from '@/services/videoInspectionApi';
import { saveScan } from '@/utils/scanStorage';
import { getSelectedModel, AVAILABLE_MODELS } from '@/utils/modelStorage';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useColorScheme } from 'nativewind';

type StreamMode = 'live' | 'video';

const RED = '#FF2D55';
const WHITE = '#FFFFFF';
const GREEN = '#10B981';

const MAX_VIDEO_SECONDS = 180;
const POLL_INTERVAL_MS = 1500;
const MAX_POLL_COUNT = 900;

type SelectedVideo = { uri: string; name: string; size: number; duration: number };

const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const resolveMediaUrl = (url?: string) => {
  if (!url) return '';
  if (url.includes('/uploads/')) {
    const filename = url.split('/uploads/').pop();
    return `${BACKEND_URL}/uploads/${filename}`;
  }
  if (url.startsWith('/')) return `${BACKEND_URL}${url}`;
  return url;
};

function VideoPlayerBox({ uri, onPlayerReady }: { uri: string; onPlayerReady?: (player: any) => void }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.play();
  });

  useEffect(() => {
    if (onPlayerReady && player) onPlayerReady(player);
  }, [player]);

  if (!uri) return null;

  return (
    <View style={vs.videoContainer}>
      <VideoView
        style={{ width: '100%', height: '100%' }}
        player={player}
        nativeControls
        allowsPictureInPicture
        contentFit="contain"
      />
    </View>
  );
}

export default function LiveVideoScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [mode, setMode] = useState<StreamMode>(params.mode === 'video' ? 'video' : 'live');

  useEffect(() => {
    if (params.mode === 'video') setMode('video');
    else if (params.mode === 'live') setMode('live');
  }, [params.mode]);

  // ---------- LIVE CAMERA STATE ----------
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [torch, setTorch] = useState(false);
  const [isStreaming, setIsStreaming] = useState(true);
  const [liveResult, setLiveResult] = useState<LiveFrameResult | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [fpsCount, setFpsCount] = useState(0);
  const [activeModelName, setActiveModelName] = useState('Standard');
  const cameraRef = useRef<CameraView>(null);
  const isLoopRunning = useRef(false);
  const activeStream = useRef(true);
  const frameCounter = useRef(0);
  const lastFpsTime = useRef(Date.now());

  useFocusEffect(
    React.useCallback(() => {
      getSelectedModel().then((id) => {
        const match = AVAILABLE_MODELS.find((m) => m.id === id);
        if (match) setActiveModelName(match.name);
      });
    }, [])
  );

  useEffect(() => {
    if (mode !== 'live') {
      activeStream.current = false;
    } else {
      activeStream.current = isStreaming;
    }
  }, [mode, isStreaming]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isStreaming && mode === 'live') {
      startAnalysisLoop();
      interval = setInterval(() => {
        const now = Date.now();
        const elapsed = (now - lastFpsTime.current) / 1000;
        setFpsCount(Math.round(frameCounter.current / elapsed));
        frameCounter.current = 0;
        lastFpsTime.current = now;
      }, 1000);
    }
    return () => {
      activeStream.current = false;
      if (interval) clearInterval(interval);
    };
  }, [isStreaming, mode]);

  const startAnalysisLoop = async () => {
    if (isLoopRunning.current) return;
    isLoopRunning.current = true;

    while (activeStream.current) {
      if (!cameraRef.current) {
        await new Promise((r) => setTimeout(r, 200));
        continue;
      }
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.35,
          base64: true,
          skipProcessing: true,
          shutterSound: false,
        });
        if (photo?.base64 && activeStream.current) {
          frameCounter.current += 1;
          const result = await sendLiveFrame(photo.base64, false);
          if (activeStream.current) setLiveResult(result);
        }
      } catch (e) {
        await new Promise((r) => setTimeout(r, 150));
      }
      await new Promise((r) => setTimeout(r, 60));
    }
    isLoopRunning.current = false;
  };

  const captureLiveReport = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
        skipProcessing: false,
      });
      if (!photo?.uri) throw new Error('Could not capture frame');
      const isDefect = liveResult?.status === 'DEFECTIVE';
      const label = liveResult?.defects[0]?.label || (isDefect ? 'Damaged' : 'Intact');
      await saveScan({
        type: 'packaging',
        title: `Live Capture: ${label}`,
        status: isDefect ? 'DEFECTIVE' : 'INTACT',
        confidence: liveResult?.max_confidence || 0.95,
        imageUri: photo.uri,
        reason: isDefect
          ? `Live Camera detected ${liveResult?.defect_count || 1} defect(s).`
          : 'Live Camera verified intact surface.',
      });
      Alert.alert('Scan Saved', `Saved snapshot as ${isDefect ? 'DEFECTIVE' : 'INTACT'} in your history.`);
    } catch (err: any) {
      Alert.alert('Capture failed', err.message || 'Could not save scan.');
    } finally {
      setCapturing(false);
    }
  };

  // ---------- VIDEO INSPECTION STATE ----------
  const [video, setVideo] = useState<SelectedVideo | null>(null);
  const [videoFps, setVideoFps] = useState(2);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [progress, setProgress] = useState(0);
  const [inspectionId, setInspectionId] = useState<string | null>(null);
  const [results, setResults] = useState<VideoInspectionResults | null>(null);
  const [error, setError] = useState('');
  const [selectedTimestamp, setSelectedTimestamp] = useState<number | null>(null);
  const requestActive = useRef(false);
  const annotatedPlayerRef = useRef<any>(null);

  useEffect(() => () => { requestActive.current = false; }, []);

  const chooseVideo = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission Denied', 'Please allow video library access in device settings.');
        return;
      }
      const selection = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsEditing: false,
        quality: 1,
        videoMaxDuration: MAX_VIDEO_SECONDS,
      });
      if (selection.canceled || !selection.assets || !selection.assets[0]) return;
      const asset = selection.assets[0];
      const rawUri = asset.uri;
      let rawName = asset.fileName || rawUri.split('/').pop() || 'inspection-video.mp4';
      if (!rawName.includes('.')) rawName = `${rawName}.mp4`;
      const duration = Math.max(0, (asset.duration || 0) / 1000);
      setVideo({ uri: rawUri, name: rawName, size: asset.fileSize || 0, duration });
      setResults(null);
      setError('');
    } catch (err: any) {
      Alert.alert('Video Error', err.message || 'Could not select video.');
    }
  };

  const startVideoInspection = async () => {
    if (!video || busy) return;
    setBusy(true);
    setProgress(5);
    setStage('Uploading video...');
    setError('');
    requestActive.current = true;

    try {
      const id = await uploadVideo(video.uri, video.name, videoFps, (uploadProgress) => {
        setProgress(Math.round(uploadProgress));
      });
      setInspectionId(id);
      setStage('Analyzing video frames...');

      let attempts = 0;
      while (requestActive.current && attempts < MAX_POLL_COUNT) {
        attempts += 1;
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        if (!requestActive.current) break;

        const statusResponse = await getVideoInspectionStatus(id);
        const prog = statusResponse.progress || 0;
        setProgress(prog);
        setStage(statusResponse.stage || 'Processing...');

        if (statusResponse.status === 'completed') {
          const finalResults = await getVideoInspectionResults(id);
          setResults(finalResults);
          setProgress(100);
          setStage('Inspection complete!');
          break;
        }
        if (statusResponse.status === 'failed') {
          throw new Error(statusResponse.error || 'Video inspection failed.');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to inspect video.');
    } finally {
      setBusy(false);
      requestActive.current = false;
    }
  };

  const [isExportingVideo, setIsExportingVideo] = useState(false);

  const exportAnnotatedVideo = async () => {
    const rawVideoUrl = results?.annotated_video_url;
    if (!rawVideoUrl && !video?.uri) {
      Alert.alert('No Video Available', 'Please complete a video inspection first.');
      return;
    }

    setIsExportingVideo(true);
    try {
      const resolvedUrl = rawVideoUrl ? resolveMediaUrl(rawVideoUrl) : video!.uri;

      if (Platform.OS === 'web') {
        const link = document.createElement('a');
        link.href = resolvedUrl;
        link.download = `inspected_${results?.inspection_id || 'video'}.mp4`;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setIsExportingVideo(false);
        return;
      }

      let localUri = resolvedUrl;

      // If remote URL, download it locally to cache directory first
      if (resolvedUrl.startsWith('http://') || resolvedUrl.startsWith('https://')) {
        const safeId = results?.inspection_id || Date.now();
        const filename = `inspected_annotated_${safeId}.mp4`;
        const targetPath = `${FileSystem.cacheDirectory}${filename}`;

        const info = await FileSystem.getInfoAsync(targetPath);
        if (info.exists && info.size && info.size > 0) {
          localUri = targetPath;
        } else {
          const downloadResult = await FileSystem.downloadAsync(resolvedUrl, targetPath);
          localUri = downloadResult.uri;
        }
      }

      const isAvailable = await Sharing.isAvailableAsync().catch(() => false);
      if (!isAvailable) {
        Alert.alert('Sharing Unavailable', `Video saved locally at: ${localUri}`);
        setIsExportingVideo(false);
        return;
      }

      await Sharing.shareAsync(localUri, {
        mimeType: 'video/mp4',
        dialogTitle: 'Share Inspected Video (Annotated)',
        UTI: 'public.movie',
      });
    } catch (err: any) {
      console.error('Video export error:', err);
      Alert.alert('Export Failed', err.message || 'Could not export or share video.');
    } finally {
      setIsExportingVideo(false);
    }
  };

  const shareTextReport = async () => {
    if (!results) return;
    try {
      const reportText = `Inspectify Video Report\nStatus: ${results.defective_frames > 0 ? 'DEFECTIVE' : 'PASS'}\nDefective Frames: ${results.defective_frames} of ${results.total_processed_frames}\nSummary: ${results.summary || 'N/A'}`;
      const path = `${FileSystem.cacheDirectory}inspection_report_${results.inspection_id}.txt`;
      await FileSystem.writeAsStringAsync(path, reportText);
      await Sharing.shareAsync(path);
    } catch {
      Alert.alert('Sharing Failed', 'Could not share report.');
    }
  };

  const shareReport = async () => {
    if (!results) return;
    Alert.alert(
      'Share & Export',
      'Choose what to export:',
      [
        {
          text: '📹 Share Annotated Video (.mp4)',
          onPress: exportAnnotatedVideo,
        },
        {
          text: '📄 Share Text Report',
          onPress: shareTextReport,
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const isDefective = liveResult?.status === 'DEFECTIVE';

  // Theme colors
  const bg = isDark ? '#000000' : '#FFFFFF';
  const cardBg = isDark ? '#121216' : '#F9F9FB';
  const pillBg = isDark ? '#1C1C22' : '#F0F0F3';
  const segBg = isDark ? '#16161C' : '#F0F0F4';
  const segActiveBg = isDark ? '#262630' : '#FFFFFF';
  const borderColor = isDark ? '#282832' : '#E2E2E8';
  const textPrimary = isDark ? '#FFFFFF' : '#0F0F12';
  const textSecondary = isDark ? '#9CA3AF' : '#6B7280';

  return (
    <SafeAreaView style={[vs.flex1, { backgroundColor: bg }]}>
      {/* Header */}
      <View style={[vs.headerArea, { backgroundColor: bg }]}>
        <View style={vs.headerRow}>
          <View>
            <Text style={[vs.headerTitle, { color: textPrimary }]}>Live & Video Check</Text>
            <Text style={[vs.headerSub, { color: textSecondary }]}>
              Point camera or upload video to find damage
            </Text>
          </View>
          <ThemeToggle />
        </View>

        {/* Segment Selector */}
        <View style={[vs.segContainer, { backgroundColor: segBg, borderColor }]}>
          <Pressable
            onPress={() => setMode('live')}
            style={[
              vs.segButton,
              mode === 'live' && [vs.segButtonActive, { backgroundColor: segActiveBg }],
            ]}
          >
            <Cctv size={18} color={mode === 'live' ? RED : textSecondary} />
            <Text style={[vs.segText, { color: mode === 'live' ? textPrimary : textSecondary }]}>
              Live Camera
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setMode('video')}
            style={[
              vs.segButton,
              mode === 'video' && [vs.segButtonActive, { backgroundColor: segActiveBg }],
            ]}
          >
            <Video size={18} color={mode === 'video' ? RED : textSecondary} />
            <Text style={[vs.segText, { color: mode === 'video' ? textPrimary : textSecondary }]}>
              Video Inspection
            </Text>
          </Pressable>
        </View>
      </View>

      {/* ===== MODE 1: LIVE CAMERA ===== */}
      {mode === 'live' && (
        <View style={vs.flex1}>
          {!permission?.granted ? (
            <View style={[vs.permBox, { backgroundColor: bg }]}>
              <View style={vs.permIcon}>
                <Camera size={34} color={RED} />
              </View>
              <Text style={[vs.permTitle, { color: textPrimary }]}>Camera Access Needed</Text>
              <Text style={[vs.permDesc, { color: textSecondary }]}>
                Inspectify needs camera access to inspect boxes in real time.
              </Text>
              <Pressable onPress={requestPermission} style={vs.permBtn}>
                <Text style={vs.permBtnText}>Enable Camera</Text>
              </Pressable>
            </View>
          ) : (
            <View style={vs.cameraWrapper}>
              <CameraView
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                facing={facing}
                enableTorch={torch}
              />

              {/* HUD Overlay */}
              <SafeAreaView style={[StyleSheet.absoluteFill, vs.hudLayer]} pointerEvents="box-none">
                {/* Top Status */}
                <View style={vs.hudTop} pointerEvents="box-none">
                  <View
                    style={[
                      vs.liveBadge,
                      {
                        backgroundColor: isDefective ? 'rgba(255,45,85,0.25)' : 'rgba(0,0,0,0.65)',
                        borderColor: isDefective ? RED : 'rgba(255,255,255,0.2)',
                      },
                    ]}
                  >
                    {isDefective ? (
                      <AlertTriangle size={18} color={RED} />
                    ) : (
                      <CheckCircle2 size={18} color={GREEN} />
                    )}
                    <Text style={[vs.liveBadgeText, { color: isDefective ? RED : WHITE }]}>
                      {isDefective ? 'DEFECT DETECTED' : 'ALL CLEAR (PASS)'}
                    </Text>
                  </View>

                  <View style={vs.fpsBadge}>
                    <Text style={vs.fpsText}>{fpsCount} FPS</Text>
                  </View>
                </View>

                {/* Viewfinder Reticle */}
                <View style={vs.reticleContainer} pointerEvents="none">
                  <View
                    style={[
                      vs.reticle,
                      {
                        borderColor: isDefective ? RED : 'rgba(255,255,255,0.35)',
                        backgroundColor: isDefective ? 'rgba(255,45,85,0.08)' : 'transparent',
                      },
                    ]}
                  >
                    <View style={[vs.corner, vs.cornerTL]} />
                    <View style={[vs.corner, vs.cornerTR]} />
                    <View style={[vs.corner, vs.cornerBL]} />
                    <View style={[vs.corner, vs.cornerBR]} />
                    {!isDefective && (
                      <View style={vs.reticleCenter}>
                        <Scan size={38} color="rgba(255,255,255,0.5)" />
                        <Text style={vs.reticleText}>POINT AT OBJECT</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Detected Bounding Boxes */}
                {liveResult?.defects && liveResult.defects.length > 0 ? (
                  liveResult.defects.map((defect) => {
                    const [x1, y1, x2, y2] = defect.box_normalized;
                    const leftPct = Math.max(0, Math.min(92, x1 * 100));
                    const topPct = Math.max(0, Math.min(92, y1 * 100));
                    const widthPct = Math.max(8, Math.min(100 - leftPct, (x2 - x1) * 100));
                    const heightPct = Math.max(8, Math.min(100 - topPct, (y2 - y1) * 100));
                    return (
                      <View
                        key={defect.id}
                        pointerEvents="none"
                        style={{
                          position: 'absolute',
                          left: `${leftPct}%`,
                          top: `${topPct}%`,
                          width: `${widthPct}%`,
                          height: `${heightPct}%`,
                          borderWidth: 3,
                          borderColor: RED,
                          borderRadius: 8,
                          backgroundColor: 'rgba(255,45,85,0.22)',
                        }}
                      >
                        <View style={[vs.corner, vs.cornerTL]} />
                        <View style={[vs.corner, vs.cornerTR]} />
                        <View style={[vs.corner, vs.cornerBL]} />
                        <View style={[vs.corner, vs.cornerBR]} />
                        <View style={vs.defectLabel}>
                          <Text style={vs.defectLabelText}>
                            {defect.label} {defect.confidence ? `${Math.round(defect.confidence * 100)}%` : ''}
                          </Text>
                        </View>
                      </View>
                    );
                  })
                ) : isDefective ? (
                  <View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      left: '15%',
                      top: '25%',
                      width: '70%',
                      height: '45%',
                      borderWidth: 3,
                      borderColor: RED,
                      borderRadius: 12,
                      backgroundColor: 'rgba(255,45,85,0.18)',
                    }}
                  >
                    <View style={[vs.corner, vs.cornerTL]} />
                    <View style={[vs.corner, vs.cornerTR]} />
                    <View style={[vs.corner, vs.cornerBL]} />
                    <View style={[vs.corner, vs.cornerBR]} />
                    <View style={vs.defectLabel}>
                      <Text style={vs.defectLabelText}>DEFECT DETECTED</Text>
                    </View>
                  </View>
                ) : null}

                {/* Bottom Controls */}
                <View style={vs.hudBottom} pointerEvents="box-none">
                  <View style={vs.actionBar}>
                    <Pressable onPress={() => setTorch((t) => !t)} style={vs.iconBtn}>
                      {torch ? <Flashlight size={24} color={RED} /> : <FlashlightOff size={24} color={WHITE} />}
                    </Pressable>

                    <Pressable onPress={() => setIsStreaming((s) => !s)} style={vs.iconBtn}>
                      {isStreaming ? <Pause size={24} color={WHITE} /> : <Play size={24} color={RED} />}
                    </Pressable>

                    <Pressable onPress={captureLiveReport} disabled={capturing} style={vs.captureBtn}>
                      {capturing ? <ActivityIndicator color={WHITE} /> : <View style={vs.captureDot} />}
                    </Pressable>

                    <Pressable onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))} style={vs.iconBtn}>
                      <RefreshCw size={24} color={WHITE} />
                    </Pressable>
                  </View>
                </View>
              </SafeAreaView>
            </View>
          )}
        </View>
      )}

      {/* ===== MODE 2: VIDEO INSPECTION ===== */}
      {mode === 'video' && (
        <ScrollView
          style={vs.flex1}
          contentContainerStyle={vs.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Upload Card */}
          <View style={[vs.card, { backgroundColor: cardBg, borderColor }]}>
            <View style={vs.cardHeader}>
              <View style={vs.cardIconBox}>
                <FileVideo2 size={24} color={RED} />
              </View>
              <View style={vs.flex1}>
                <Text style={[vs.cardTitle, { color: textPrimary }]}>Inspect a Video</Text>
                <Text style={[vs.cardSub, { color: textSecondary }]}>
                  Scan multiple items from a recorded video
                </Text>
              </View>
            </View>

            {/* Video Selector */}
            <Pressable
              onPress={chooseVideo}
              disabled={busy}
              style={[vs.videoSelector, { backgroundColor: pillBg, borderColor }]}
            >
              <Upload size={26} color={RED} />
              <Text style={[vs.videoSelectorTitle, { color: textPrimary }]}>
                {video ? video.name : 'Select Video File'}
              </Text>
              <Text style={[vs.videoSelectorSub, { color: textSecondary }]}>
                {video
                  ? `${formatSize(video.size)} • ${formatTime(video.duration)}`
                  : 'Tap to choose video from gallery (up to 3 min)'}
              </Text>
            </Pressable>

            {/* Speed Option */}
            <View style={{ marginBottom: 16 }}>
              <Text style={[vs.sectionLabel, { color: textPrimary }]}>Inspection Speed & Smoothness:</Text>
              <View style={vs.fpsRow}>
                {[
                  { rate: 1, label: 'Fast (1 FPS)' },
                  { rate: 2, label: 'Standard (2 FPS)' },
                  { rate: 5, label: 'Detailed (5 FPS)' },
                  { rate: 24, label: 'Smooth (24 FPS)' },
                  { rate: 30, label: 'Ultra (30 FPS)' },
                ].map((item) => (
                  <Pressable
                    key={item.rate}
                    onPress={() => setVideoFps(item.rate)}
                    disabled={busy}
                    style={[
                      vs.fpsChip,
                      {
                        backgroundColor: videoFps === item.rate ? RED : pillBg,
                        borderColor: videoFps === item.rate ? RED : borderColor,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        vs.fpsChipText,
                        { color: videoFps === item.rate ? WHITE : textSecondary },
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Start Button */}
            <Pressable
              onPress={startVideoInspection}
              disabled={!video || busy}
              style={[
                vs.startBtn,
                { backgroundColor: !video || busy ? (isDark ? '#262630' : '#E2E2E8') : RED },
              ]}
            >
              {busy ? (
                <View style={vs.row}>
                  <ActivityIndicator color={WHITE} size="small" />
                  <Text style={vs.startBtnText}>Analyzing Video...</Text>
                </View>
              ) : (
                <Text
                  style={[
                    vs.startBtnText,
                    { color: !video ? textSecondary : WHITE },
                  ]}
                >
                  Start Video Inspection
                </Text>
              )}
            </Pressable>

            {/* Progress */}
            {busy && (
              <View style={[vs.progressBox, { backgroundColor: pillBg, borderColor }]}>
                <View style={vs.progressHeader}>
                  <Text style={[vs.progressStage, { color: textPrimary }]}>
                    {stage || 'Inspecting frames...'}
                  </Text>
                  <Text style={vs.progressPct}>{progress}%</Text>
                </View>
                <View style={[vs.progressTrack, { backgroundColor: isDark ? '#282832' : '#E2E2E8' }]}>
                  <View style={[vs.progressFill, { width: `${progress}%` }]} />
                </View>
              </View>
            )}

            {error ? (
              <View style={vs.errorBox}>
                <Text style={vs.errorText}>{error}</Text>
              </View>
            ) : null}
          </View>

          {/* Results */}
          {results && (
            <View style={{ marginTop: 16, gap: 14 }}>
              <View style={[vs.card, { backgroundColor: cardBg, borderColor }]}>
                <View style={vs.verdictHeader}>
                  <View style={vs.row}>
                    {results.defective_frames > 0 ? (
                      <AlertTriangle size={26} color={RED} />
                    ) : (
                      <CheckCircle2 size={26} color={GREEN} />
                    )}
                    <Text
                      style={[
                        vs.verdictTitle,
                        { color: results.defective_frames > 0 ? RED : GREEN },
                      ]}
                    >
                      {results.defective_frames > 0 ? 'Defects Detected' : 'All Clear (Pass)'}
                    </Text>
                  </View>
                  <Pressable onPress={shareReport} style={[vs.shareBtn, { backgroundColor: pillBg }]}>
                    <Share2 size={18} color={RED} />
                  </Pressable>
                </View>

                <View style={vs.statsRow}>
                  <View style={[vs.statCell, { backgroundColor: pillBg, borderColor }]}>
                    <Text style={[vs.statLabel, { color: textSecondary }]}>Damaged Frames</Text>
                    <Text style={vs.statValueRed}>{results.defective_frames}</Text>
                  </View>
                  <View style={[vs.statCell, { backgroundColor: pillBg, borderColor }]}>
                    <Text style={[vs.statLabel, { color: textSecondary }]}>Total Frames</Text>
                    <Text style={[vs.statValue, { color: textPrimary }]}>{results.total_processed_frames}</Text>
                  </View>
                </View>

                {results.summary && (
                  <Text style={[vs.summaryText, { color: textSecondary }]}>{results.summary}</Text>
                )}
              </View>

              {/* Video Player */}
              {results.annotated_video_url && (
                <View style={[vs.card, { backgroundColor: cardBg, borderColor }]}>
                  <View style={vs.videoCardHeader}>
                    <Text style={[vs.sectionLabel, { color: textPrimary, marginBottom: 0 }]}>
                      Reviewed Video (with Bounding Boxes)
                    </Text>
                    <Pressable
                      onPress={exportAnnotatedVideo}
                      disabled={isExportingVideo}
                      style={[vs.videoExportPill, { backgroundColor: pillBg, borderColor }]}
                    >
                      {isExportingVideo ? (
                        <ActivityIndicator size="small" color={RED} />
                      ) : (
                        <>
                          <Download size={14} color={RED} />
                          <Text style={[vs.videoExportPillText, { color: RED }]}>Export</Text>
                        </>
                      )}
                    </Pressable>
                  </View>

                  <VideoPlayerBox
                    uri={resolveMediaUrl(results.annotated_video_url)}
                    onPlayerReady={(p) => { annotatedPlayerRef.current = p; }}
                  />

                  {/* Prominent Export / Share Video CTA */}
                  <Pressable
                    onPress={exportAnnotatedVideo}
                    disabled={isExportingVideo}
                    style={[vs.exportFullBtn, { backgroundColor: RED }]}
                  >
                    {isExportingVideo ? (
                      <View style={vs.row}>
                        <ActivityIndicator size="small" color={WHITE} />
                        <Text style={vs.exportFullBtnText}>Preparing Video Export...</Text>
                      </View>
                    ) : (
                      <View style={vs.row}>
                        <Share2 size={16} color={WHITE} />
                        <Text style={vs.exportFullBtnText}>Share / Save Video with Bounding Boxes</Text>
                      </View>
                    )}
                  </Pressable>
                </View>
              )}

              {/* Defect Markers */}
              {results.defect_timestamps && results.defect_timestamps.length > 0 && (
                <View style={[vs.card, { backgroundColor: cardBg, borderColor }]}>
                  <Text style={[vs.sectionLabel, { color: textPrimary, marginBottom: 10 }]}>
                    Damage Timestamps ({results.defect_timestamps.length})
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={vs.timelineRow}>
                      {results.defect_timestamps.map((t, idx) => (
                        <Pressable
                          key={idx}
                          onPress={() => {
                            setSelectedTimestamp(t.timestamp_seconds);
                            if (annotatedPlayerRef.current) {
                              annotatedPlayerRef.current.currentTime = t.timestamp_seconds;
                            }
                          }}
                          style={[
                            vs.timelineChip,
                            {
                              backgroundColor: selectedTimestamp === t.timestamp_seconds ? RED : pillBg,
                              borderColor: selectedTimestamp === t.timestamp_seconds ? RED : borderColor,
                            },
                          ]}
                        >
                          <Clock3 size={14} color={selectedTimestamp === t.timestamp_seconds ? WHITE : RED} />
                          <Text
                            style={[
                              vs.timelineChipTime,
                              { color: selectedTimestamp === t.timestamp_seconds ? WHITE : textPrimary },
                            ]}
                          >
                            {t.timestamp_seconds.toFixed(1)}s
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const vs = StyleSheet.create({
  flex1: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 48 },
  headerArea: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  headerTitle: { fontSize: 26, fontWeight: '800', letterSpacing: -0.4 },
  headerSub: { fontSize: 14, fontWeight: '500', marginTop: 3 },
  segContainer: {
    flexDirection: 'row',
    padding: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  segButton: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  segButtonActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  segText: { fontSize: 14, fontWeight: '700' },
  cameraWrapper: { flex: 1, backgroundColor: '#000000' },
  hudLayer: { justifyContent: 'space-between', padding: 18 },
  hudTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 50,
    borderWidth: 1,
  },
  liveBadgeText: { fontSize: 13, fontWeight: '800' },
  fpsBadge: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  fpsText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  reticleContainer: { ...StyleSheet.absoluteFill, justifyContent: 'center', alignItems: 'center' },
  reticle: { width: 250, height: 250, borderWidth: 2, borderRadius: 24 },
  corner: { position: 'absolute', width: 20, height: 20, borderColor: RED, borderWidth: 4 },
  cornerTL: { top: -1, left: -1, borderTopLeftRadius: 6, borderRightWidth: 0, borderBottomWidth: 0 },
  cornerTR: { top: -1, right: -1, borderTopRightRadius: 6, borderLeftWidth: 0, borderBottomWidth: 0 },
  cornerBL: { bottom: -1, left: -1, borderBottomLeftRadius: 6, borderRightWidth: 0, borderTopWidth: 0 },
  cornerBR: { bottom: -1, right: -1, borderBottomRightRadius: 6, borderLeftWidth: 0, borderTopWidth: 0 },
  reticleCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  reticleText: { fontSize: 12, fontWeight: '700', letterSpacing: 1.5, color: 'rgba(255,255,255,0.7)', marginTop: 8 },
  defectLabel: { position: 'absolute', top: -26, left: -2, backgroundColor: RED, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  defectLabelText: { color: WHITE, fontSize: 12, fontWeight: '800' },
  hudBottom: { gap: 12 },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  iconBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },
  captureBtn: { width: 62, height: 62, borderRadius: 31, backgroundColor: RED, borderWidth: 3, borderColor: WHITE, justifyContent: 'center', alignItems: 'center' },
  captureDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: WHITE },
  permBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  permIcon: { width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(255,45,85,0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  permTitle: { fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  permDesc: { textAlign: 'center', marginBottom: 24, fontSize: 14, lineHeight: 20 },
  permBtn: { backgroundColor: RED, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14 },
  permBtnText: { color: WHITE, fontWeight: '700', fontSize: 15 },
  card: { borderRadius: 18, borderWidth: 1, padding: 18, marginTop: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  cardIconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,45,85,0.1)', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 17, fontWeight: '800' },
  cardSub: { fontSize: 13, marginTop: 2 },
  videoSelector: { padding: 18, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  videoSelectorTitle: { fontSize: 15, fontWeight: '700', marginTop: 8 },
  videoSelectorSub: { fontSize: 13, marginTop: 3 },
  sectionLabel: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  fpsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fpsChip: { minWidth: '30%', flexGrow: 1, paddingVertical: 10, paddingHorizontal: 6, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  fpsChipText: { fontSize: 12, fontWeight: '700' },
  startBtn: { paddingVertical: 15, borderRadius: 14, alignItems: 'center' },
  startBtnText: { fontSize: 15, fontWeight: '800' },
  progressBox: { marginTop: 14, padding: 14, borderRadius: 12, borderWidth: 1 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressStage: { fontSize: 13, fontWeight: '700', flex: 1 },
  progressPct: { fontSize: 13, fontWeight: '800', color: RED },
  progressTrack: { width: '100%', height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: RED, borderRadius: 4 },
  errorBox: { marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: 'rgba(239,68,68,0.1)' },
  errorText: { fontSize: 13, color: '#EF4444', fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  verdictHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  verdictTitle: { fontSize: 18, fontWeight: '800', marginLeft: 8 },
  shareBtn: { padding: 8, borderRadius: 10 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  statCell: { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1 },
  statLabel: { fontSize: 12, fontWeight: '500' },
  statValue: { fontSize: 18, fontWeight: '800', marginTop: 2 },
  statValueRed: { fontSize: 18, fontWeight: '800', marginTop: 2, color: RED },
  summaryText: { fontSize: 13, lineHeight: 19, fontWeight: '500' },
  timelineRow: { flexDirection: 'row', gap: 8 },
  timelineChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  timelineChipTime: { fontSize: 13, fontWeight: '700' },
  videoContainer: { width: '100%', height: 220, backgroundColor: '#000000', borderRadius: 14, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  videoCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  videoExportPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  videoExportPillText: { fontSize: 12, fontWeight: '700' },
  exportFullBtn: { marginTop: 12, paddingVertical: 13, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  exportFullBtnText: { color: WHITE, fontSize: 14, fontWeight: '700' },
});
