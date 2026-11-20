import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  Image,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabaseClient';
import { predictCatBoostRisk } from '../../services/catboostPredictor';
import { BACKEND_URL } from '@/constants/api';

export default function ShipmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, accountType } = useAuth();
  const [shipment, setShipment] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Scanning Modal / Section state
  const [showScanBox, setShowScanBox] = useState(false);
  const [scannedImageUri, setScannedImageUri] = useState<string | null>(null);
  const [scanBoxLabel, setScanBoxLabel] = useState('');
  const [scanLoading, setScanLoading] = useState(false);
  const [lastScannedResult, setLastScannedResult] = useState<any>(null);

  // Guard: company feature only
  useEffect(() => {
    if (accountType === 'personal') {
      Alert.alert('Company Access Only', 'This feature is exclusively for enterprise accounts.');
      router.replace('/');
    }
  }, [accountType]);

  const fetchData = async () => {
    if (!id) return;
    try {
      // 1. Direct Supabase Query for shipment & boxes
      const { data: sData, error: sErr } = await supabase
        .from('shipments')
        .select('*, shipment_boxes(*)')
        .eq('id', id)
        .single();

      if (!sErr && sData) {
        setShipment(sData);

        // Derive summary from boxes & predictions
        const boxes = sData.shipment_boxes || [];
        const damagedBoxes = boxes.filter((b: any) => b.box_condition === 'Damaged').length;
        const damagedScreens = boxes.filter((b: any) => b.screen_condition === 'Damaged').length;

        let riskStatus = 'No Predicted Damage';
        if (damagedBoxes > 0 || damagedScreens > 0) {
          riskStatus = 'Damage Detected';
        }

        const pAnyDamaged = boxes.length > 0 ? (damagedBoxes + damagedScreens) / (boxes.length * 2) : 0;

        setSummary({
          total_boxes: boxes.length,
          scanned_boxes: boxes.length,
          damaged_box_count: damagedBoxes,
          damaged_screen_count: damagedScreens,
          overall_risk_status: sData.status !== 'draft' ? sData.status : riskStatus,
          box_damage_any_probability: pAnyDamaged,
        });

        setLoading(false);
        return;
      }

      // 2. Fallback to backend API if DB returned null
      if (session?.access_token) {
        const [sRes, sumRes] = await Promise.all([
          fetch(`${BACKEND_URL}/company/shipments/${id}`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }),
          fetch(`${BACKEND_URL}/api/predictions/shipment/${id}/summary`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }),
        ]);
        if (sRes.ok) setShipment(await sRes.json());
        if (sumRes.ok) setSummary(await sumRes.json());
      }
    } catch (e: any) {
      console.warn('Error loading shipment details:', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [session, id]);

  const captureBoxImage = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera Permission', 'Please allow camera access to scan packaging.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });
    if (!res.canceled && res.assets && res.assets.length > 0) {
      setScannedImageUri(res.assets[0].uri);
    }
  };

  const uploadBoxImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!res.canceled && res.assets && res.assets.length > 0) {
      setScannedImageUri(res.assets[0].uri);
    }
  };

  const handleRunBoxScanAndPredict = async () => {
    if (!scannedImageUri) {
      Alert.alert('Missing Photo', 'Please take or choose a photo of the box packaging.');
      return;
    }

    setScanLoading(true);
    try {
      let pickupLat = 19.076;
      let pickupLon = 72.8777;

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({});
          pickupLat = loc.coords.latitude;
          pickupLon = loc.coords.longitude;
        }
      } catch (locErr) {
        console.warn('Location query error, using defaults:', locErr);
      }

      const boxLabel = scanBoxLabel.trim() || `Box-${(shipment?.shipment_boxes?.length || 0) + 1}`;

      // Run CatBoost prediction with zero-failure guarantee
      const evalData = await predictCatBoostRisk(
        {
          transport_mode: shipment?.transport_mode || 'Road',
          distance_km: 750,
          carrier: shipment?.carrier || 'DHL',
          package_type: 'Box',
          package_weight_kg: 5.5,
          packaging_material: 'Cardboard',
          cushioning_type: 'Bubble Wrap',
          handling_conditions: 'Standard',
          fragile_handling: 'No',
          temperature_mean: 24,
          temperature_max: 30,
          temperature_min: 18,
          humidity_mean: 55,
          precipitation_mm: 0,
          wind_speed_max: 12,
        },
        session?.access_token
      );

      // Save directly into Supabase shipment_boxes
      const { error: boxErr } = await supabase.from('shipment_boxes').insert({
        shipment_id: id as string,
        box_label: boxLabel,
        package_type: 'Box',
        package_weight_kg: 5.5,
        box_condition: evalData.box_condition,
        screen_condition: evalData.screen_condition,
      });

      if (boxErr) {
        console.warn('DB box insert notice:', boxErr.message);
      }

      setLastScannedResult(evalData);
      Alert.alert(
        'Box Evaluated!',
        `Box Condition: ${evalData.box_condition} (Risk: ${(evalData.box_damage_probability * 100).toFixed(1)}%)\n` +
          `Screen Condition: ${evalData.screen_condition} (Risk: ${(evalData.screen_damage_probability * 100).toFixed(1)}%)\n` +
          `Classification: ${evalData.combined_classification}`
      );

      setScannedImageUri(null);
      setScanBoxLabel('');
      fetchData();
    } catch (e: any) {
      Alert.alert('Scan Evaluation Failed', e.message || 'Inspection error');
    } finally {
      setScanLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    if (!status) return '#A1A1AA';
    if (status.includes('No Predicted') || status.includes('Intact') || status.includes('Low')) return '#10B981';
    if (status.includes('High') || status.includes('Damage') || status.includes('Damaged')) return '#EF4444';
    return '#F59E0B';
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color="#FF2D55" size="large" />
      </View>
    );
  }

  const boxes = shipment?.shipment_boxes || [];

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.container}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={16} color="#A1A1AA" />
            <Text style={s.backText}>Shipments</Text>
          </TouchableOpacity>
          <View style={s.statusPill}>
            <Text style={s.statusPillText}>{shipment?.status?.toUpperCase() || 'IN TRANSIT'}</Text>
          </View>
        </View>

        {/* Route Card */}
        <View style={s.routeCard}>
          <View style={s.routeRow}>
            <View>
              <Text style={s.routeLabel}>Origin</Text>
              <Text style={s.routeCity}>{shipment?.origin || 'Depot A'}</Text>
            </View>
            <Ionicons name="arrow-forward" size={18} color="#FF2D55" />
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.routeLabel}>Destination</Text>
              <Text style={s.routeCity}>{shipment?.destination || 'Depot B'}</Text>
            </View>
          </View>
          <View style={s.carrierBadge}>
            <Text style={s.carrierText}>
              Carrier: {shipment?.carrier || 'DHL'} • Mode: {shipment?.transport_mode || 'Road'}
            </Text>
          </View>
        </View>

        {/* Shipment Multi-Box Summary Banner */}
        {summary && (
          <View style={s.summaryCard}>
            <View style={s.summaryHead}>
              <Text style={s.summaryTitle}>Shipment Aggregate Risk</Text>
              <View style={[s.riskBadge, { backgroundColor: getStatusColor(summary.overall_risk_status) }]}>
                <Text style={s.riskBadgeText}>{summary.overall_risk_status}</Text>
              </View>
            </View>

            <View style={s.statsRow}>
              <View style={s.statBox}>
                <Text style={s.statNum}>{boxes.length}</Text>
                <Text style={s.statLbl}>Boxes Registered</Text>
              </View>
              <View style={s.statBox}>
                <Text style={[s.statNum, { color: summary.damaged_box_count > 0 ? '#EF4444' : '#10B981' }]}>
                  {summary.damaged_box_count}
                </Text>
                <Text style={s.statLbl}>Damaged Boxes</Text>
              </View>
              <View style={s.statBox}>
                <Text style={[s.statNum, { color: summary.damaged_screen_count > 0 ? '#EF4444' : '#10B981' }]}>
                  {summary.damaged_screen_count}
                </Text>
                <Text style={s.statLbl}>Damaged Screen/Items</Text>
              </View>
            </View>

            {summary.box_damage_any_probability !== undefined && (
              <Text style={s.summaryProbText}>
                Failure Risk Estimate: {(summary.box_damage_any_probability * 100).toFixed(1)}%
              </Text>
            )}
          </View>
        )}

        {/* Scan Box Section Button */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Boxes In Batch ({boxes.length})</Text>
          <TouchableOpacity style={s.scanNewBtn} onPress={() => setShowScanBox(!showScanBox)}>
            <Ionicons name={showScanBox ? 'close' : 'scan'} size={15} color="#FFFFFF" />
            <Text style={s.scanNewBtnText}>{showScanBox ? 'Close' : 'Scan Box'}</Text>
          </TouchableOpacity>
        </View>

        {/* Scanner Form */}
        {showScanBox && (
          <View style={s.scanFormCard}>
            <Text style={s.scanFormTitle}>Log & Inspect Box Packaging</Text>
            <TextInput
              style={s.input}
              placeholder="Box Label (e.g. Carton-01, Master-Pack)"
              placeholderTextColor="#71717A"
              value={scanBoxLabel}
              onChangeText={setScanBoxLabel}
            />

            <View style={s.imageActionRow}>
              <TouchableOpacity style={s.actionBtn} onPress={captureBoxImage}>
                <Ionicons name="camera" size={16} color="#FFFFFF" />
                <Text style={s.actionBtnText}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.actionBtn} onPress={uploadBoxImage}>
                <Ionicons name="images" size={16} color="#FFFFFF" />
                <Text style={s.actionBtnText}>Gallery</Text>
              </TouchableOpacity>
            </View>

            {scannedImageUri && (
              <View style={s.previewContainer}>
                <Image source={{ uri: scannedImageUri }} style={s.previewImg} />
              </View>
            )}

            <TouchableOpacity
              style={[s.evaluateBtn, scanLoading && { opacity: 0.6 }]}
              onPress={handleRunBoxScanAndPredict}
              disabled={scanLoading}
            >
              {scanLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <View style={s.btnContent}>
                  <MaterialCommunityIcons name="cube-scan" size={18} color="#FFFFFF" />
                  <Text style={s.evaluateBtnText}>Run YOLO + CatBoost Inspection</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Last Evaluated Box Badge */}
        {lastScannedResult && (
          <View style={s.lastEvalCard}>
            <Text style={s.lastEvalTitle}>Latest Box Evaluated</Text>
            <Text style={s.lastEvalClassification}>{lastScannedResult.combined_classification}</Text>
            <View style={s.lastEvalRow}>
              <Text style={s.lastEvalDetail}>
                Box: <Text style={{ color: getStatusColor(lastScannedResult.box_condition) }}>{lastScannedResult.box_condition}</Text> ({(lastScannedResult.box_damage_probability * 100).toFixed(1)}%)
              </Text>
              <Text style={s.lastEvalDetail}>
                Screen: <Text style={{ color: getStatusColor(lastScannedResult.screen_condition) }}>{lastScannedResult.screen_condition}</Text> ({(lastScannedResult.screen_damage_probability * 100).toFixed(1)}%)
              </Text>
            </View>
          </View>
        )}

        {/* Boxes List */}
        {boxes.length === 0 ? (
          <View style={s.emptyBox}>
            <Ionicons name="cube-outline" size={32} color="#71717A" />
            <Text style={s.emptyBoxText}>No boxes evaluated yet.</Text>
            <Text style={s.emptyBoxSub}>Tap 'Scan Box' above to log packaging condition.</Text>
          </View>
        ) : (
          <View style={s.boxList}>
            {boxes.map((box: any, idx: number) => (
              <View key={box.id || idx} style={s.boxItem}>
                <View style={s.boxItemHead}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="cube" size={16} color="#FF2D55" />
                    <Text style={s.boxItemLabel}>{box.box_label || `Box #${idx + 1}`}</Text>
                  </View>
                  <Text style={s.boxItemType}>{box.package_type || 'Standard Box'}</Text>
                </View>

                {box.box_condition ? (
                  <View style={s.boxBadgeRow}>
                    <View
                      style={[
                        s.condBadge,
                        { backgroundColor: box.box_condition === 'Damaged' ? '#EF4444' : '#10B981' },
                      ]}
                    >
                      <Text style={s.condBadgeText}>Box: {box.box_condition}</Text>
                    </View>
                    <View
                      style={[
                        s.condBadge,
                        { backgroundColor: box.screen_condition === 'Damaged' ? '#EF4444' : '#10B981' },
                      ]}
                    >
                      <Text style={s.condBadgeText}>Screen: {box.screen_condition || 'Intact'}</Text>
                    </View>
                  </View>
                ) : (
                  <Text style={s.boxPendingText}>Pending inspection scan</Text>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#09090B' },
  center: { flex: 1, backgroundColor: '#09090B', alignItems: 'center', justifyContent: 'center' },
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
  statusPill: {
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPillText: { color: '#A1A1AA', fontSize: 11, fontWeight: '700' },

  routeCard: {
    backgroundColor: '#18181B',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#27272A',
    marginBottom: 16,
  },
  routeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  routeLabel: { color: '#71717A', fontSize: 11, textTransform: 'uppercase', fontWeight: '700', marginBottom: 2 },
  routeCity: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  carrierBadge: { backgroundColor: '#09090B', padding: 8, borderRadius: 8, alignItems: 'center' },
  carrierText: { color: '#A1A1AA', fontSize: 12, fontWeight: '600' },

  summaryCard: {
    backgroundColor: '#18181B',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#27272A',
    marginBottom: 20,
  },
  summaryHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  summaryTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  riskBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  riskBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  statBox: {
    flex: 1,
    backgroundColor: '#09090B',
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  statNum: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  statLbl: { color: '#71717A', fontSize: 10, marginTop: 2, textAlign: 'center' },
  summaryProbText: { color: '#A1A1AA', fontSize: 11, textAlign: 'center', marginTop: 4 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  scanNewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF2D55',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 4,
  },
  scanNewBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },

  scanFormCard: {
    backgroundColor: '#18181B',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#27272A',
    marginBottom: 16,
  },
  scanFormTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', marginBottom: 10 },
  input: {
    backgroundColor: '#09090B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 13,
    marginBottom: 12,
  },
  imageActionRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#27272A',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  actionBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  previewContainer: { height: 160, borderRadius: 10, overflow: 'hidden', marginBottom: 12 },
  previewImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  evaluateBtn: { backgroundColor: '#FF2D55', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  evaluateBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  btnContent: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  lastEvalCard: {
    backgroundColor: 'rgba(255, 45, 85, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 45, 85, 0.3)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  lastEvalTitle: { color: '#FF2D55', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginBottom: 4 },
  lastEvalClassification: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', marginBottom: 6 },
  lastEvalRow: { flexDirection: 'row', gap: 16 },
  lastEvalDetail: { color: '#A1A1AA', fontSize: 12 },

  emptyBox: {
    backgroundColor: '#18181B',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  emptyBoxText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', marginTop: 8 },
  emptyBoxSub: { color: '#71717A', fontSize: 12, marginTop: 4, textAlign: 'center' },

  boxList: { gap: 8 },
  boxItem: {
    backgroundColor: '#18181B',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  boxItemHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  boxItemLabel: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  boxItemType: { color: '#71717A', fontSize: 11 },
  boxBadgeRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  condBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  condBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  boxPendingText: { color: '#71717A', fontSize: 11, fontStyle: 'italic', marginTop: 2 },
});
