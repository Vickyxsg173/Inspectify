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
import { BACKEND_URL } from '@/constants/api';

export default function ShipmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [shipment, setShipment] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [predicting, setPredicting] = useState(false);

  // Scanning Modal / Section state
  const [showScanBox, setShowScanBox] = useState(false);
  const [scannedImageUri, setScannedImageUri] = useState<string | null>(null);
  const [scanBoxLabel, setScanBoxLabel] = useState('');
  const [scanLoading, setScanLoading] = useState(false);
  const [lastScannedResult, setLastScannedResult] = useState<any>(null);

  const fetchData = async () => {
    if (!session || !id) return;
    try {
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
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not load shipment details.');
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
      // 1. Get Live GPS for Location Support
      let pickupLat = 19.0760;
      let pickupLon = 72.8777;
      let dropLat = 28.6139;
      let dropLon = 77.2090;

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

      // 2. Prepare Form Data
      const formData = new FormData();
      const filename = scannedImageUri.split('/').pop() || 'box.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      formData.append('image', {
        uri: scannedImageUri,
        name: filename,
        type,
      } as any);

      formData.append('shipment_id', id as string);
      formData.append('box_label', scanBoxLabel.trim() || `Box-${(shipment?.shipment_boxes?.length || 0) + 1}`);
      formData.append('pickup_lat', String(pickupLat));
      formData.append('pickup_lon', String(pickupLon));
      formData.append('drop_lat', String(dropLat));
      formData.append('drop_lon', String(dropLon));
      formData.append('carrier', shipment?.carrier || 'DHL');

      const res = await fetch(`${BACKEND_URL}/api/predictions/scan-company-box`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Server status ${res.status}`);
      }

      const evalData = await res.json();
      setLastScannedResult(evalData);
      Alert.alert(
        'Box Evaluated!',
        `Box Status: ${evalData.box_condition}\nScreen Status: ${evalData.screen_condition}\nClassification: ${evalData.combined_classification}`
      );
      setScannedImageUri(null);
      setScanBoxLabel('');
      fetchData();
    } catch (e: any) {
      Alert.alert('Scan Evaluation Failed', e.message);
    } finally {
      setScanLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    if (!status) return '#A1A1AA';
    if (status.includes('No Predicted') || status.includes('Low')) return '#10B981';
    if (status.includes('High') || status.includes('Damage Detected')) return '#EF4444';
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
        {summary && summary.scanned_boxes > 0 && (
          <View style={s.summaryCard}>
            <View style={s.summaryHead}>
              <Text style={s.summaryTitle}>Shipment Aggregate Risk</Text>
              <View
                style={[
                  s.riskBadge,
                  { backgroundColor: getStatusColor(summary.overall_risk_status) },
                ]}
              >
                <Text style={s.riskBadgeText}>{summary.overall_risk_status}</Text>
              </View>
            </View>

            <View style={s.statsRow}>
              <View style={s.statBox}>
                <Text style={s.statNum}>{summary.scanned_boxes} / {summary.total_boxes || summary.scanned_boxes}</Text>
                <Text style={s.statLbl}>Boxes Scanned</Text>
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
                P(at least one box damaged): {(summary.box_damage_any_probability * 100).toFixed(1)}%
              </Text>
            )}
          </View>
        )}

        {/* Scan Box Section Button */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Boxes In Batch ({boxes.length})</Text>
          <TouchableOpacity
            style={s.scanNewBtn}
            onPress={() => setShowScanBox(!showScanBox)}
          >
            <Ionicons name={showScanBox ? 'close' : 'scan'} size={15} color="#FFFFFF" />
            <Text style={s.scanNewBtnText}>{showScanBox ? 'Cancel' : 'Scan Box Packaging'}</Text>
          </TouchableOpacity>
        </View>

        {/* Scanning Workflow Block */}
        {showScanBox && (
          <View style={s.scanBoxWrapper}>
            <Text style={s.scanBoxHeading}>Scan Box Packaging (Condition & Risk)</Text>
            <Text style={s.scanBoxSub}>
              Snap the packaging. YOLO inspects tears & dents while Gemini LLM calculates route road shock. CatBoost then outputs damage risk for the box and screen.
            </Text>

            <TextInput
              style={s.input}
              placeholder="Box Label / Barcode (e.g. BOX-003)"
              placeholderTextColor="#71717A"
              value={scanBoxLabel}
              onChangeText={setScanBoxLabel}
            />

            <View style={s.photoPickerRow}>
              <TouchableOpacity style={s.photoBtn} onPress={captureBoxImage}>
                <Ionicons name="camera" size={18} color="#FFFFFF" />
                <Text style={s.photoBtnText}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.photoBtn} onPress={uploadBoxImage}>
                <Ionicons name="images" size={18} color="#FFFFFF" />
                <Text style={s.photoBtnText}>Gallery</Text>
              </TouchableOpacity>
            </View>

            {scannedImageUri && (
              <View style={s.thumbnailWrap}>
                <Image source={{ uri: scannedImageUri }} style={s.thumbnail} />
                <Text style={s.thumbnailNote}>Packaging photo ready</Text>
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
                <Text style={s.evaluateBtnText}>Analyze Box Packaging & Predict Risk</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Last Evaluated Box LLM Narrative */}
        {lastScannedResult && (
          <View style={s.narrativeCard}>
            <View style={s.narrativeHead}>
              <MaterialCommunityIcons name="road-variant" size={18} color="#FF2D55" />
              <Text style={s.narrativeTitle}>Route & Road Condition Impact</Text>
            </View>
            <Text style={s.narrativeBody}>
              {lastScannedResult.road_condition_assessment || 'Standard corridor transit assessed with baseline vibration.'}
            </Text>
            {lastScannedResult.weather_impact_assessment ? (
              <Text style={[s.narrativeBody, { marginTop: 6, color: '#A1A1AA' }]}>
                Weather Impact: {lastScannedResult.weather_impact_assessment}
              </Text>
            ) : null}
          </View>
        )}

        {/* List of Boxes in Shipment */}
        {boxes.length === 0 ? (
          <View style={s.emptyBox}>
            <Text style={s.emptyText}>No package units registered yet.</Text>
            <Text style={s.emptySub}>Tap "Scan Box Packaging" above to scan and log units.</Text>
          </View>
        ) : (
          <View style={s.boxList}>
            {boxes.map((box: any) => (
              <View key={box.id} style={s.boxCard}>
                <View style={s.boxCardHead}>
                  <Text style={s.boxTitle}>{box.box_label || `Box #${box.id.slice(0, 6)}`}</Text>
                  {box.box_condition ? (
                    <View
                      style={[
                        s.condBadge,
                        { backgroundColor: box.box_condition === 'Damaged' ? '#EF4444' : '#10B981' },
                      ]}
                    >
                      <Text style={s.condBadgeText}>
                        Box: {box.box_condition}
                      </Text>
                    </View>
                  ) : (
                    <Text style={s.pendingBadge}>Evaluated via ML</Text>
                  )}
                </View>
                <Text style={s.boxDesc}>
                  Type: {box.package_type || 'Box'} • Weight: {box.weight_kg ? `${box.weight_kg} kg` : 'Estimated'}
                </Text>
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
  center: { flex: 1, backgroundColor: '#09090B', justifyContent: 'center', alignItems: 'center' },
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
  statusPill: { backgroundColor: '#18181B', borderWidth: 1, borderColor: '#27272A', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusPillText: { color: '#A1A1AA', fontSize: 11, fontWeight: '700' },
  routeCard: { backgroundColor: '#18181B', borderWidth: 1, borderColor: '#27272A', borderRadius: 16, padding: 16, marginBottom: 16 },
  routeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  routeLabel: { color: '#71717A', fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  routeCity: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  carrierBadge: { backgroundColor: '#09090B', padding: 8, borderRadius: 8, alignItems: 'center' },
  carrierText: { color: '#A1A1AA', fontSize: 12, fontWeight: '600' },
  summaryCard: { backgroundColor: '#18181B', borderWidth: 1, borderColor: '#27272A', borderRadius: 16, padding: 16, marginBottom: 20 },
  summaryHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  summaryTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  riskBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  riskBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  statBox: { flex: 1, backgroundColor: '#09090B', padding: 10, borderRadius: 10, alignItems: 'center' },
  statNum: { fontSize: 18, fontWeight: '900', color: '#FFFFFF', marginBottom: 2 },
  statLbl: { fontSize: 10, color: '#71717A', fontWeight: '600', textAlign: 'center' },
  summaryProbText: { color: '#A1A1AA', fontSize: 12, textAlign: 'center', marginTop: 4 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  scanNewBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF2D55', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, gap: 6 },
  scanNewBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  scanBoxWrapper: { backgroundColor: '#18181B', borderWidth: 1, borderColor: '#FF2D55', borderRadius: 16, padding: 16, marginBottom: 20 },
  scanBoxHeading: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', marginBottom: 4 },
  scanBoxSub: { color: '#A1A1AA', fontSize: 12, lineHeight: 16, marginBottom: 12 },
  input: { backgroundColor: '#09090B', borderWidth: 1, borderColor: '#27272A', borderRadius: 12, padding: 12, color: '#FFFFFF', fontSize: 13, marginBottom: 12 },
  photoPickerRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  photoBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#27272A', paddingVertical: 10, borderRadius: 10, gap: 6 },
  photoBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  thumbnailWrap: { height: 140, borderRadius: 12, overflow: 'hidden', backgroundColor: '#09090B', marginBottom: 12, position: 'relative' },
  thumbnail: { width: '100%', height: '100%', resizeMode: 'cover' },
  thumbnailNote: { position: 'absolute', bottom: 6, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', color: '#FFFFFF', fontSize: 10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  evaluateBtn: { backgroundColor: '#FF2D55', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  evaluateBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  narrativeCard: { backgroundColor: 'rgba(255, 45, 85, 0.05)', borderWidth: 1, borderColor: 'rgba(255, 45, 85, 0.2)', padding: 14, borderRadius: 14, marginBottom: 16 },
  narrativeHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  narrativeTitle: { color: '#FF2D55', fontSize: 13, fontWeight: '700' },
  narrativeBody: { color: '#D4D4D8', fontSize: 12, lineHeight: 17 },
  emptyBox: { borderWidth: 1, borderStyle: 'dashed', borderColor: '#27272A', padding: 24, borderRadius: 16, alignItems: 'center', marginVertical: 12 },
  emptyText: { color: '#71717A', fontSize: 13, fontWeight: '600' },
  emptySub: { color: '#52525B', fontSize: 11, marginTop: 4 },
  boxList: { gap: 8 },
  boxCard: { backgroundColor: '#18181B', borderWidth: 1, borderColor: '#27272A', padding: 14, borderRadius: 12 },
  boxCardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  boxTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  condBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  condBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  pendingBadge: { color: '#71717A', fontSize: 11, fontWeight: '600' },
  boxDesc: { color: '#71717A', fontSize: 12 },
});
