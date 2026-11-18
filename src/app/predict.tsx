import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { BACKEND_URL } from '@/constants/api';

export default function PredictScreen() {
  const { session } = useAuth();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera permission is required to scan packages.');
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        setImageUri(res.assets[0].uri);
        setResult(null);
        setError(null);
        runScanAndPredict(res.assets[0].uri);
      }
    } catch (e: any) {
      Alert.alert('Camera Error', e.message);
    }
  };

  const pickImage = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        setImageUri(res.assets[0].uri);
        setResult(null);
        setError(null);
        runScanAndPredict(res.assets[0].uri);
      }
    } catch (e: any) {
      Alert.alert('Gallery Error', e.message);
    }
  };

  const runScanAndPredict = async (uri: string) => {
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      const filename = uri.split('/').pop() || 'box_scan.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      formData.append('image', {
        uri,
        name: filename,
        type,
      } as any);

      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const res = await fetch(`${BACKEND_URL}/api/predictions/scan-personal`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Server responded with status ${res.status}`);
      }

      const data = await res.json();
      setResult(data);
    } catch (e: any) {
      const msg = e.message || 'Failed to complete package scan.';
      setError(msg);
      Alert.alert('Scan Evaluation Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const isDamaged = result?.box_status === 'Damaged';
  const isScreenDamaged = result?.inner_screen_status === 'Damaged';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={18} color="#A1A1AA" />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <View style={styles.tag}>
            <Text style={styles.tagText}>Instant AI QC</Text>
          </View>
        </View>

        <Text style={styles.title}>Package Damage Risk</Text>
        <Text style={styles.subtitle}>
          Take or upload a photo of your received parcel. Inspectify evaluates box shock/crush damage and predicts if internal contents or screens are intact.
        </Text>

        {/* Scan Actions */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.scanBtnPrimary} onPress={takePhoto} disabled={loading}>
            <Ionicons name="camera" size={20} color="#FFFFFF" />
            <Text style={styles.scanBtnText}>Take Photo</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.scanBtnSecondary} onPress={pickImage} disabled={loading}>
            <Ionicons name="images" size={20} color="#FFFFFF" />
            <Text style={styles.scanBtnText}>Upload Photo</Text>
          </TouchableOpacity>
        </View>

        {/* Image Preview & Loading Indicator */}
        {imageUri && (
          <View style={styles.previewContainer}>
            <Image source={{ uri: imageUri }} style={styles.previewImage} />
            {loading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#FF2D55" />
                <Text style={styles.loadingText}>Analyzing box damage with YOLO & CatBoost ML...</Text>
              </View>
            )}
          </View>
        )}

        {/* Error Display */}
        {error && (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle" size={20} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Prediction Results */}
        {result && (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <Text style={styles.classification}>{result.combined_classification}</Text>
              <View style={[styles.statusBadge, { backgroundColor: isDamaged ? '#EF4444' : '#10B981' }]}>
                <Text style={styles.statusBadgeText}>{result.box_status.toUpperCase()}</Text>
              </View>
            </View>

            {/* Condition Summary */}
            {result.summary_text ? (
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionHeading}>Packaging Condition</Text>
                <Text style={styles.sectionBody}>{result.summary_text}</Text>
              </View>
            ) : null}

            {/* Risk Probability Cards */}
            <View style={styles.metricRow}>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Box Risk</Text>
                <Text style={[styles.metricVal, { color: isDamaged ? '#EF4444' : '#10B981' }]}>
                  {result.box_damage_risk_pct}%
                </Text>
                <Text style={styles.metricStatus}>{result.box_status}</Text>
              </View>

              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Screen / Content Risk</Text>
                <Text style={[styles.metricVal, { color: isScreenDamaged ? '#EF4444' : '#10B981' }]}>
                  {result.screen_damage_risk_pct}%
                </Text>
                <Text style={styles.metricStatus}>{result.inner_screen_status}</Text>
              </View>
            </View>

            {/* Inner Content Shock Analysis */}
            {result.inner_risk_text ? (
              <View style={styles.riskAssessmentBlock}>
                <View style={styles.assessmentHeadingRow}>
                  <MaterialCommunityIcons name="shield-search" size={18} color="#FF2D55" />
                  <Text style={styles.assessmentHeading}>Internal Product Assessment</Text>
                </View>
                <Text style={styles.assessmentBody}>{result.inner_risk_text}</Text>
              </View>
            ) : null}

            <Text style={styles.latencyNote}>
              Model v{result.model_version} • Evaluated in {result.latency_ms}ms
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#09090B' },
  container: { padding: 20, paddingBottom: 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
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
  tag: {
    backgroundColor: 'rgba(255, 45, 85, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 45, 85, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagText: { color: '#FF2D55', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  title: { fontSize: 26, fontWeight: '900', color: '#FFFFFF', marginBottom: 6 },
  subtitle: { fontSize: 13, color: '#A1A1AA', lineHeight: 20, marginBottom: 20 },
  actionRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  scanBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF2D55',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  scanBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#27272A',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  scanBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  previewContainer: {
    width: '100%',
    height: 240,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#18181B',
    marginBottom: 20,
    position: 'relative',
  },
  previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: { color: '#FFFFFF', marginTop: 12, textAlign: 'center', fontSize: 13, fontWeight: '500' },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorText: { color: '#EF4444', fontSize: 13, flex: 1 },
  resultCard: {
    backgroundColor: '#18181B',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 18,
    marginBottom: 20,
  },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  classification: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', flex: 1, marginRight: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  sectionBlock: { marginBottom: 14 },
  sectionHeading: { fontSize: 12, fontWeight: '700', color: '#A1A1AA', textTransform: 'uppercase', marginBottom: 4 },
  sectionBody: { fontSize: 13, color: '#D4D4D8', lineHeight: 18 },
  metricRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  metricCard: {
    flex: 1,
    backgroundColor: '#09090B',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  metricLabel: { fontSize: 11, color: '#71717A', fontWeight: '600', marginBottom: 4 },
  metricVal: { fontSize: 20, fontWeight: '900', marginBottom: 2 },
  metricStatus: { fontSize: 12, color: '#A1A1AA', fontWeight: '500' },
  riskAssessmentBlock: {
    backgroundColor: 'rgba(255, 45, 85, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 45, 85, 0.2)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  assessmentHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  assessmentHeading: { color: '#FF2D55', fontWeight: '700', fontSize: 12 },
  assessmentBody: { color: '#E4E4E7', fontSize: 12, lineHeight: 18 },
  latencyNote: { fontSize: 11, color: '#52525B', textAlign: 'right' },
});
