import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  Alert,
  StyleSheet,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  X,
  Plus,
  Package,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  CloudUpload,
  Trash2,
  Check,
  RefreshCw,
  Search,
  Box,
} from 'lucide-react-native';
import {
  ShipmentRecord,
  getShipments,
  createManualShipment,
  addBoxToShipment,
  setActiveShipmentId,
  setActiveBoxForShipment,
  offloadShipmentToCloud,
  deleteShipment,
  generateShipmentId,
  generateBoxId,
} from '@/utils/shipmentStorage';
import { BACKEND_URL } from '@/constants/api';

const RED = '#FF2D55';
const WHITE = '#FFFFFF';
const GREEN = '#10B981';

interface Props {
  visible: boolean;
  activeShipmentId: string;
  isDark: boolean;
  onClose: () => void;
  onSelectShipment: (id: string) => void;
  onShipmentsChanged: () => void;
  onSelectBox?: (shipmentId: string, boxId: string) => void;
}

export function ShipmentTraceabilityModal({
  visible,
  activeShipmentId,
  isDark,
  onClose,
  onSelectShipment,
  onShipmentsChanged,
  onSelectBox,
}: Props) {
  const [shipments, setShipments] = useState<ShipmentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [offloadingId, setOffloadingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Creation State
  const [isCreating, setIsCreating] = useState(false);
  const [creationMode, setCreationMode] = useState<'manual' | 'auto'>('manual');
  const [manualShipmentId, setManualShipmentId] = useState('');
  const [manualBoxId, setManualBoxId] = useState('BOX-01');
  const [batchNote, setBatchNote] = useState('');

  // Inline "Add Box to Shipment" State
  const [addingBoxShipmentId, setAddingBoxShipmentId] = useState<string | null>(null);
  const [newBoxInputId, setNewBoxInputId] = useState('');

  const bg = isDark ? '#000000' : '#FFFFFF';
  const cardBg = isDark ? '#121216' : '#FFFFFF';
  const pillBg = isDark ? '#1C1C22' : '#F4F4F6';
  const boxCardBg = isDark ? '#18181E' : '#F9F9FB';
  const borderColor = isDark ? '#282832' : '#E2E2E8';
  const textPrimary = isDark ? '#FFFFFF' : '#0F0F12';
  const textSecondary = isDark ? '#9CA3AF' : '#6B7280';

  const loadData = async () => {
    setLoading(true);
    const list = await getShipments();
    setShipments(list);
    setLoading(false);
  };

  useEffect(() => {
    if (visible) {
      loadData();
      if (!manualShipmentId) {
        setManualShipmentId(generateShipmentId());
      }
    }
  }, [visible]);

  const handleStartCreate = () => {
    setManualShipmentId(generateShipmentId());
    setManualBoxId('BOX-01');
    setBatchNote('');
    setIsCreating(true);
  };

  const handleConfirmCreateShipment = async () => {
    const idToUse = creationMode === 'manual' ? manualShipmentId.trim() : generateShipmentId();
    if (!idToUse) {
      Alert.alert('Validation Error', 'Please enter a Shipment ID.');
      return;
    }

    try {
      const created = await createManualShipment({
        shipmentId: idToUse,
        initialBoxId: manualBoxId.trim() || 'BOX-01',
        batchLabel: batchNote.trim() || undefined,
      });

      setIsCreating(false);
      setBatchNote('');
      await loadData();
      onSelectShipment(created.id);
      onShipmentsChanged();
      Alert.alert(
        'Shipment Created',
        `Batch: ${created.id}\nPackage: ${created.activeBoxId}\n\nReady for box and screen scanning.`
      );
    } catch (err: any) {
      Alert.alert('Could Not Create Batch', err.message || 'Error creating shipment.');
    }
  };

  const handleAddBox = async (shipmentId: string) => {
    const boxIdToAdd = newBoxInputId.trim();
    if (!boxIdToAdd) {
      Alert.alert('Validation Error', 'Please enter a Box / Package ID (e.g. BOX-02).');
      return;
    }

    try {
      const updated = await addBoxToShipment(shipmentId, boxIdToAdd);
      setAddingBoxShipmentId(null);
      setNewBoxInputId('');
      await loadData();
      onShipmentsChanged();
      if (updated && onSelectBox) {
        onSelectBox(shipmentId, boxIdToAdd);
      }
      Alert.alert('Package Added', `Package "${boxIdToAdd}" added to shipment.`);
    } catch (err: any) {
      Alert.alert('Could Not Add Box', err.message || 'Error adding box.');
    }
  };

  const handleSetActiveBox = async (shipmentId: string, boxId: string) => {
    try {
      await setActiveBoxForShipment(shipmentId, boxId);
      await setActiveShipmentId(shipmentId);
      await loadData();
      onSelectShipment(shipmentId);
      if (onSelectBox) onSelectBox(shipmentId, boxId);
      onShipmentsChanged();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not activate box.');
    }
  };

  const handleOffloadToCloud = (shipment: ShipmentRecord) => {
    Alert.alert(
      'Upload to Cloud Storage',
      `Upload batch ${shipment.id} to cloud backup?\n\nThis will remove image files from your device to free up storage space.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Upload & Free Storage',
          style: 'default',
          onPress: async () => {
            setOffloadingId(shipment.id);
            setTimeout(async () => {
              const res = await offloadShipmentToCloud(shipment.id);
              setOffloadingId(null);
              if (res.success) {
                await loadData();
                onShipmentsChanged();
                Alert.alert('Uploaded', 'Batch saved to cloud. Device storage has been freed.');
              } else {
                Alert.alert('Upload Failed', res.error || 'Could not offload.');
              }
            }, 1000);
          },
        },
      ]
    );
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      'Delete Batch',
      `Are you sure you want to delete batch ${id}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteShipment(id);
            await loadData();
            onShipmentsChanged();
          },
        },
      ]
    );
  };

  const filteredShipments = shipments.filter(
    (s) =>
      s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.batchLabel && s.batchLabel.toLowerCase().includes(searchQuery.toLowerCase())) ||
      s.boxes?.some((b) => b.boxId.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const resolveImg = (uri?: string, annot?: string) => {
    if (annot) return `${BACKEND_URL}/uploads/${annot}`;
    if (uri && !uri.startsWith('file://')) {
      return uri.startsWith('http') ? uri : `${BACKEND_URL}/uploads/${uri}`;
    }
    return uri || '';
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: borderColor }]}>
          <View>
            <Text style={[styles.headerTitle, { color: textPrimary }]}>Shipment Batches</Text>
            <Text style={[styles.headerSub, { color: textSecondary }]}>
              Organize boxes and scanned screens
            </Text>
          </View>
          <Pressable onPress={onClose} style={[styles.closeBtn, { backgroundColor: pillBg }]}>
            <X size={20} color={textPrimary} />
          </Pressable>
        </View>

        {/* Search & New Batch Action */}
        <View style={styles.topActions}>
          <View style={[styles.searchBox, { backgroundColor: pillBg, borderColor }]}>
            <Search size={18} color={textSecondary} />
            <TextInput
              placeholder="Search by Shipment or Box ID..."
              placeholderTextColor={textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={[styles.searchInput, { color: textPrimary }]}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')}>
                <X size={16} color={textSecondary} />
              </Pressable>
            )}
          </View>

          <Pressable
            onPress={isCreating ? () => setIsCreating(false) : handleStartCreate}
            style={[styles.newBatchBtn, { backgroundColor: RED }]}
          >
            {isCreating ? <X size={18} color={WHITE} /> : <Plus size={18} color={WHITE} />}
            <Text style={styles.newBatchBtnText}>{isCreating ? 'Close' : 'New Batch'}</Text>
          </Pressable>
        </View>

        {/* Create Batch Card */}
        {isCreating && (
          <View style={[styles.createCard, { backgroundColor: cardBg, borderColor }]}>
            <View style={styles.rowBetween}>
              <Text style={[styles.createTitle, { color: textPrimary }]}>Create New Batch</Text>
              <View style={[styles.modeSwitch, { backgroundColor: pillBg, borderColor }]}>
                <Pressable
                  onPress={() => setCreationMode('manual')}
                  style={[styles.modeBtn, creationMode === 'manual' && { backgroundColor: RED }]}
                >
                  <Text style={[styles.modeBtnText, { color: creationMode === 'manual' ? WHITE : textSecondary }]}>
                    Custom ID
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setCreationMode('auto');
                    setManualShipmentId(generateShipmentId());
                  }}
                  style={[styles.modeBtn, creationMode === 'auto' && { backgroundColor: RED }]}
                >
                  <Text style={[styles.modeBtnText, { color: creationMode === 'auto' ? WHITE : textSecondary }]}>
                    Auto Generate
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Inputs */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: textSecondary }]}>SHIPMENT ID</Text>
              <View style={styles.rowAlign}>
                <TextInput
                  placeholder="e.g. SHP-2026-01"
                  placeholderTextColor={textSecondary}
                  value={manualShipmentId}
                  onChangeText={setManualShipmentId}
                  style={[styles.createInput, { color: textPrimary, borderColor, backgroundColor: pillBg, flex: 1 }]}
                  autoCapitalize="characters"
                />
                {creationMode === 'auto' && (
                  <Pressable
                    onPress={() => setManualShipmentId(generateShipmentId())}
                    style={[styles.regenBtn, { backgroundColor: pillBg, borderColor }]}
                  >
                    <RefreshCw size={16} color={RED} />
                  </Pressable>
                )}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: textSecondary }]}>FIRST BOX ID</Text>
              <TextInput
                placeholder="e.g. BOX-01"
                placeholderTextColor={textSecondary}
                value={manualBoxId}
                onChangeText={setManualBoxId}
                style={[styles.createInput, { color: textPrimary, borderColor, backgroundColor: pillBg }]}
                autoCapitalize="characters"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: textSecondary }]}>OPTIONAL NOTES / VENDOR</Text>
              <TextInput
                placeholder="e.g. Supplier Foxconn"
                placeholderTextColor={textSecondary}
                value={batchNote}
                onChangeText={setBatchNote}
                style={[styles.createInput, { color: textPrimary, borderColor, backgroundColor: pillBg }]}
              />
            </View>

            <View style={styles.createBtnRow}>
              <Pressable onPress={() => setIsCreating(false)} style={[styles.cancelBtn, { borderColor }]}>
                <Text style={{ color: textSecondary, fontWeight: '600', fontSize: 14 }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleConfirmCreateShipment} style={[styles.confirmBtn, { backgroundColor: RED }]}>
                <Check size={18} color={WHITE} />
                <Text style={styles.confirmBtnText}>Save & Start</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Shipments List */}
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={RED} />
            <Text style={[styles.centerText, { color: textSecondary }]}>Loading batches...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.flex1}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {filteredShipments.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor }]}>
                <Package size={44} color={RED} style={{ marginBottom: 12 }} />
                <Text style={[styles.emptyTitle, { color: textPrimary }]}>No Batches Found</Text>
                <Text style={[styles.emptySub, { color: textSecondary }]}>
                  Tap "+ New Batch" above to start a shipment and organize your scans.
                </Text>
              </View>
            ) : (
              filteredShipments.map((shipment) => {
                const isActive = shipment.id === activeShipmentId;
                const isOffloaded = shipment.status === 'OFFLOADED';
                const totalBoxes = shipment.boxes?.length || 1;
                const totalScreens = shipment.screens?.length || 0;
                const hasDefects =
                  shipment.boxes?.some((b) => b.status === 'DEFECTIVE') ||
                  shipment.screens?.some((s) => s.status === 'DEFECTIVE');
                const hasScans = shipment.boxes?.some((b) => !!b.status) || totalScreens > 0;

                return (
                  <View
                    key={shipment.id}
                    style={[
                      styles.shipmentCard,
                      { backgroundColor: cardBg, borderColor },
                      isActive && { borderColor: RED, borderWidth: 2 },
                    ]}
                  >
                    {/* Shipment Header */}
                    <View style={styles.cardHeader}>
                      <View style={{ flex: 1 }}>
                        <View style={styles.rowAlign}>
                          <Text style={[styles.shipmentIdText, { color: textPrimary }]}>
                            {shipment.id}
                          </Text>
                          {isActive && (
                            <View style={styles.activeBadge}>
                              <Text style={styles.activeBadgeText}>ACTIVE</Text>
                            </View>
                          )}
                        </View>
                        <Text style={[styles.dateText, { color: textSecondary }]}>
                          Created: {new Date(shipment.createdAt).toLocaleDateString()}
                          {shipment.batchLabel ? ` • ${shipment.batchLabel}` : ''}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.statusBadge,
                          {
                            backgroundColor: !hasScans
                              ? pillBg
                              : hasDefects
                              ? 'rgba(255,45,85,0.1)'
                              : 'rgba(16,185,129,0.1)',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            {
                              color: !hasScans ? textSecondary : hasDefects ? RED : GREEN,
                            },
                          ]}
                        >
                          {!hasScans ? 'PENDING' : hasDefects ? 'DEFECT' : 'PASS'}
                        </Text>
                      </View>
                    </View>

                    {/* Boxes inside this Shipment */}
                    <View style={{ gap: 10, marginVertical: 12 }}>
                      {shipment.boxes.map((box, bIdx) => {
                        const isBoxActive = shipment.activeBoxId === box.boxId;
                        const boxScreens = box.screens || [];
                        const isBoxIntact = box.status === 'INTACT';
                        const isBoxDefective = box.status === 'DEFECTIVE';

                        return (
                          <View
                            key={box.boxId || bIdx}
                            style={[styles.boxCard, { backgroundColor: boxCardBg, borderColor }]}
                          >
                            <View style={styles.rowBetween}>
                              <View style={styles.rowAlign}>
                                <Box size={16} color={RED} />
                                <Text style={[styles.boxTitle, { color: textPrimary }]}>
                                  Package: {box.boxId}
                                </Text>
                                {isBoxActive && (
                                  <View style={styles.activePill}>
                                    <Text style={styles.activePillText}>Selected</Text>
                                  </View>
                                )}
                              </View>

                              {!isBoxActive && (
                                <Pressable
                                  onPress={() => handleSetActiveBox(shipment.id, box.boxId)}
                                  style={[styles.selectBoxBtn, { borderColor }]}
                                >
                                  <Text style={[styles.selectBoxBtnText, { color: textSecondary }]}>
                                    Select
                                  </Text>
                                </Pressable>
                              )}
                            </View>

                            {/* Summary info */}
                            <Text style={[styles.boxSummary, { color: textSecondary }]}>
                              Box condition:{' '}
                              <Text
                                style={{
                                  color: isBoxIntact ? GREEN : isBoxDefective ? RED : textSecondary,
                                  fontWeight: '700',
                                }}
                              >
                                {box.status || 'Not scanned'}
                              </Text>{' '}
                              • {boxScreens.length} screen(s)
                            </Text>
                          </View>
                        );
                      })}

                      {/* Add Box to this shipment */}
                      {addingBoxShipmentId === shipment.id ? (
                        <View style={[styles.addBoxCard, { backgroundColor: pillBg, borderColor }]}>
                          <TextInput
                            placeholder={`e.g. ${generateBoxId(shipment.boxes.length + 1)}`}
                            placeholderTextColor={textSecondary}
                            value={newBoxInputId}
                            onChangeText={setNewBoxInputId}
                            style={[styles.addBoxInput, { color: textPrimary, borderColor, backgroundColor: cardBg }]}
                            autoCapitalize="characters"
                          />
                          <View style={styles.createBtnRow}>
                            <Pressable
                              onPress={() => setAddingBoxShipmentId(null)}
                              style={[styles.cancelBtn, { borderColor }]}
                            >
                              <Text style={{ color: textSecondary, fontWeight: '600', fontSize: 13 }}>Cancel</Text>
                            </Pressable>
                            <Pressable
                              onPress={() => handleAddBox(shipment.id)}
                              style={[styles.confirmBtn, { backgroundColor: RED }]}
                            >
                              <Text style={styles.confirmBtnText}>Add Package</Text>
                            </Pressable>
                          </View>
                        </View>
                      ) : (
                        <Pressable
                          onPress={() => {
                            setAddingBoxShipmentId(shipment.id);
                            setNewBoxInputId(generateBoxId(shipment.boxes.length + 1));
                          }}
                          style={[styles.addBoxBtn, { borderColor }]}
                        >
                          <Plus size={15} color={RED} />
                          <Text style={styles.addBoxBtnText}>+ Add Another Package to {shipment.id}</Text>
                        </Pressable>
                      )}
                    </View>

                    {/* Footer Actions */}
                    <View style={[styles.footerRow, { borderTopColor: borderColor }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.storageText, { color: textSecondary }]}>
                          {isOffloaded ? '☁️ Uploaded to cloud' : `📱 ${totalBoxes} pkg, ${totalScreens} screens`}
                        </Text>
                      </View>

                      <View style={styles.rowAlign}>
                        {/* Upload to Cloud Button */}
                        <Pressable
                          onPress={() => handleOffloadToCloud(shipment)}
                          disabled={offloadingId === shipment.id || isOffloaded}
                          style={[
                            styles.uploadBtn,
                            {
                              backgroundColor: isOffloaded ? pillBg : RED,
                              borderColor,
                            },
                          ]}
                        >
                          {offloadingId === shipment.id ? (
                            <ActivityIndicator size="small" color={WHITE} />
                          ) : (
                            <CloudUpload size={15} color={isOffloaded ? textSecondary : WHITE} />
                          )}
                          <Text
                            style={[
                              styles.uploadBtnText,
                              { color: isOffloaded ? textSecondary : WHITE },
                            ]}
                          >
                            {isOffloaded ? 'Offloaded' : 'Upload to Cloud'}
                          </Text>
                        </Pressable>

                        {!isActive && (
                          <Pressable
                            onPress={() => {
                              onSelectShipment(shipment.id);
                              onShipmentsChanged();
                            }}
                            style={[styles.activateBtn, { borderColor, backgroundColor: pillBg }]}
                          >
                            <Text style={[styles.activateBtnText, { color: textPrimary }]}>Activate</Text>
                          </Pressable>
                        )}

                        <Pressable
                          onPress={() => handleDelete(shipment.id)}
                          style={[styles.deleteBtn, { backgroundColor: pillBg }]}
                        >
                          <Trash2 size={16} color="#EF4444" />
                        </Pressable>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  headerSub: { fontSize: 13, marginTop: 2 },
  closeBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  topActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 10,
    alignItems: 'center',
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  newBatchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    gap: 6,
  },
  newBatchBtnText: { color: WHITE, fontWeight: '700', fontSize: 14 },
  createCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
  },
  createTitle: { fontSize: 16, fontWeight: '800' },
  modeSwitch: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    padding: 2,
    gap: 2,
  },
  modeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  modeBtnText: { fontSize: 12, fontWeight: '700' },
  inputGroup: { marginTop: 12 },
  inputLabel: { fontSize: 11, fontWeight: '700', marginBottom: 4 },
  createInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
  },
  regenBtn: {
    marginLeft: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createBtnRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 14 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, borderWidth: 1 },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    gap: 6,
  },
  confirmBtnText: { color: WHITE, fontWeight: '700', fontSize: 14 },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  centerText: { fontSize: 14, fontWeight: '500' },
  listContent: { paddingHorizontal: 20, paddingBottom: 40, gap: 14 },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 36,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 20,
  },
  emptyTitle: { fontSize: 17, fontWeight: '800' },
  emptySub: { fontSize: 13, textAlign: 'center', marginTop: 6 },
  shipmentCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  shipmentIdText: { fontSize: 17, fontWeight: '800' },
  activeBadge: {
    backgroundColor: RED,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  activeBadgeText: { color: WHITE, fontSize: 10, fontWeight: '800' },
  dateText: { fontSize: 12, marginTop: 3 },
  statusBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  statusBadgeText: { fontSize: 11, fontWeight: '800' },
  boxCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  boxTitle: { fontSize: 14, fontWeight: '700', marginLeft: 8 },
  activePill: {
    backgroundColor: 'rgba(255,45,85,0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  activePillText: { color: RED, fontSize: 10, fontWeight: '700' },
  selectBoxBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  selectBoxBtnText: { fontSize: 11, fontWeight: '600' },
  boxSummary: { fontSize: 12, marginTop: 6 },
  addBoxBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: 6,
  },
  addBoxBtnText: { color: RED, fontSize: 13, fontWeight: '700' },
  addBoxCard: { padding: 12, borderRadius: 12, borderWidth: 1 },
  addBoxInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    marginTop: 4,
  },
  storageText: { fontSize: 12, fontWeight: '500' },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  uploadBtnText: { fontSize: 12, fontWeight: '700' },
  activateBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginLeft: 6,
  },
  activateBtnText: { fontSize: 12, fontWeight: '700' },
  deleteBtn: { padding: 8, borderRadius: 8, marginLeft: 6 },
  rowAlign: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
